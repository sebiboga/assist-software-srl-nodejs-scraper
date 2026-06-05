import { jest } from '@jest/globals';

const mockFetch = jest.fn();

jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch
}));

function anafSearchResponse(results) {
  return {
    ok: true,
    json: async () => ({ data: results, success: true })
  };
}

function anafCompanyResponse(data) {
  return {
    ok: true,
    json: async () => ({ data, success: true })
  };
}

function errorResponse(status) {
  return {
    ok: false,
    status,
    text: async () => 'Error'
  };
}

const ASSIST_ANAF_RECORD = {
  cui: 2693736,
  name: 'ASSIST SOFTWARE SRL',
  address: 'STR. UNIVERSITĂȚII, 13C, BIROUL 1, Suceava, Suceava',
  caenCode: '6201',
  inactive: false,
  registrationNumber: 'J33/123/1992',
  vatRegistered: true,
  onrcStatusLabel: 'Funcțiune',
  legalForm: 'SRL'
};

const CACHED_DATA = {
  cui: 2693736,
  name: 'ASSIST SOFTWARE SRL',
  address: 'STR. UNIVERSITĂȚII, 13C, BIROUL 1, Suceava',
  registrationNumber: 'J33/123/1992',
  caenCode: '6201',
  inactive: false,
  onrcStatusLabel: 'Funcțiune',
  administrators: [{ name: 'ADMIN', role: 'administrator' }],
  authorizedCaenCodes: ['6201', '6202']
};

describe('src/anaf.js', () => {
  let anaf;

  beforeAll(async () => {
    anaf = await import('../../src/anaf.js');
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('searchCompany', () => {
    it('should return array of companies for valid brand', async () => {
      mockFetch.mockResolvedValue(anafSearchResponse([
        { cui: 2693736, name: 'ASSIST SOFTWARE SRL', statusLabel: 'Funcțiune' }
      ]));

      const results = await anaf.searchCompany('ASSIST SOFTWARE');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('cui');
      expect(results[0]).toHaveProperty('name');
    });

    it('should return empty array for non-existent brand', async () => {
      mockFetch.mockResolvedValue(anafSearchResponse([]));

      const results = await anaf.searchCompany('NonExistentBrandXYZ123');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValue(errorResponse(500));

      await expect(anaf.searchCompany('ASSIST')).rejects.toThrow('ANAF search error: 500');
    });
  });

  describe('getCompanyFromANAF', () => {
    it('should return company data for valid CIF', async () => {
      mockFetch.mockResolvedValue(anafCompanyResponse(ASSIST_ANAF_RECORD));

      const data = await anaf.getCompanyFromANAF('2693736');

      expect(data).toBeDefined();
      expect(data.cui).toBe(2693736);
      expect(data.name).toBe('ASSIST SOFTWARE SRL');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('registrationNumber');
    });

    it('should retry on HTTP error then succeed', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500))
        .mockResolvedValueOnce(anafCompanyResponse(ASSIST_ANAF_RECORD));

      const data = await anaf.getCompanyFromANAF('2693736');

      expect(data).toBeDefined();
      expect(data.cui).toBe(2693736);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting retries', async () => {
      mockFetch.mockResolvedValue(errorResponse(500));

      await expect(anaf.getCompanyFromANAF('2693736')).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle API-level error response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: { message: 'Company not found' } })
      });

      await expect(anaf.getCompanyFromANAF('00000000')).rejects.toThrow();
    });

    it('should return null when data is null', async () => {
      mockFetch.mockResolvedValue(anafCompanyResponse(null));

      const data = await anaf.getCompanyFromANAF('2693736');
      expect(data).toBeNull();
    });
  });

  describe('getCompanyFromANAFWithFallback', () => {
    it('should return fresh data when API works', async () => {
      mockFetch.mockResolvedValue(anafCompanyResponse(ASSIST_ANAF_RECORD));

      const data = await anaf.getCompanyFromANAFWithFallback('2693736');

      expect(data.name).toBe('ASSIST SOFTWARE SRL');
    });

    it('should use cached data when API fails', async () => {
      mockFetch.mockResolvedValue(errorResponse(500));

      const data = await anaf.getCompanyFromANAFWithFallback('2693736', CACHED_DATA);

      expect(data).toEqual(CACHED_DATA);
    });

    it('should throw when API fails and no cache available', async () => {
      mockFetch.mockResolvedValue(errorResponse(500));

      await expect(anaf.getCompanyFromANAFWithFallback('2693736')).rejects.toThrow();
    });
  });
});
