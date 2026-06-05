import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const HAS_SOLR = !!process.env.SOLR_AUTH;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: SOLR_AUTH not set)`, fn, timeout);
}

beforeAll(() => {
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
});

const TEST_CIF = '2693736';
const TEST_BRAND = 'ASSIST SOFTWARE';
const CAREER_URL = 'https://assist-software.net/jobs';
const ROMANIAN_CITIES = ['Suceava'];

describe('E2E: Full Scraping Pipeline', () => {

  describe('ASSIST SOFTWARE Website — Real Data Fetch', () => {
    let html;

    beforeAll(async () => {
      const res = await fetch(CAREER_URL, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'text/html'
        }
      });
      html = await res.text();
    }, 15000);

    it('should respond with valid HTML from ASSIST SOFTWARE jobs page', () => {
      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    it('should contain job listing cards', () => {
      expect(html).toContain('group flex flex-col');
    });

    it('should contain job titles', () => {
      expect(html).toContain('font-500 group-hover');
    });
  });

  describe('Parse + Transform Pipeline', () => {
    let index;
    let html;

    beforeAll(async () => {
      index = await import('../../index.js');
      const res = await fetch(CAREER_URL, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'text/html'
        }
      });
      html = await res.text();
    }, 15000);

    it('should parse real ASSIST SOFTWARE HTML into standardized format', () => {
      const jobs = index.parseJobsPage(html);

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThan(0);

      const parsed = jobs[0];
      expect(parsed).toHaveProperty('url');
      expect(parsed.url).toMatch(/^https:\/\/assist-software\.net\//);
      expect(parsed).toHaveProperty('title');
      expect(typeof parsed.title).toBe('string');
      expect(parsed.title.length).toBeGreaterThan(0);
      expect(parsed).toHaveProperty('workmode');
      expect(['remote', 'on-site', 'hybrid']).toContain(parsed.workmode);
      expect(parsed).toHaveProperty('location');
      expect(parsed.location).toEqual(['Suceava']);
    });

    it('should map parsed jobs to job model', () => {
      const jobs = index.parseJobsPage(html);
      const model = index.mapToJobModel(jobs[0], TEST_CIF);

      expect(model).toHaveProperty('url');
      expect(model).toHaveProperty('title');
      expect(model).toHaveProperty('company');
      expect(model).toHaveProperty('cif', TEST_CIF);
      expect(model).toHaveProperty('status', 'scraped');
      expect(model).toHaveProperty('date');
      expect(model.url).toMatch(/^https:\/\/assist-software\.net\//);
    });

    it('should transform jobs for SOLR', () => {
      const jobs = index.parseJobsPage(html);
      const models = jobs.map(j => index.mapToJobModel(j, TEST_CIF));

      const payload = {
        source: 'assist-software.net',
        company: 'ASSIST SOFTWARE SRL',
        cif: TEST_CIF,
        jobs: models
      };

      const transformed = index.transformJobsForSOLR(payload);

      expect(transformed.company).toBe('ASSIST SOFTWARE SRL');
      expect(transformed.jobs.length).toBe(jobs.length);

      for (const job of transformed.jobs) {
        expect(job).toHaveProperty('location');
        expect(Array.isArray(job.location)).toBe(true);
        expect(job.location.length).toBeGreaterThan(0);
        expect(job.workmode).toMatch(/^(remote|on-site|hybrid)$/);
      }
    });

    it('should produce valid job URLs that are accessible', async () => {
      const jobs = index.parseJobsPage(html);

      for (const job of jobs.slice(0, 2)) {
        const res = await fetch(job.url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'job_seeker_ro_spider' }
        });
        expect(res.ok).toBe(true);
      }
    }, 30000);
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      company = await import('../../company.js');
    });

    it('should find ASSIST SOFTWARE in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const assist = results.find(c =>
        c.name.toUpperCase().startsWith(TEST_BRAND) &&
        c.statusLabel === 'Funcțiune'
      );
      expect(assist).toBeDefined();
      expect(assist.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should run full validation and report active status with job count', async () => {
      const result = await company.validateAndGetCompany();

      expect(result.status).toBe('active');
      expect(result.company).toBe('ASSIST SOFTWARE SRL');
      expect(result.cif).toBe(TEST_CIF);
      expect(result.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Inactive Company Handling', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    it('should detect inactive/radiated companies via ANAF', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const nonActive = results.find(c => c.statusLabel !== 'Funcțiune');

      if (nonActive) {
        try {
          const anafData = await anaf.getCompanyFromANAF(nonActive.cui.toString());
          expect(anafData).toBeDefined();
          if (anafData.inactive !== undefined) {
            expect(anafData.inactive).toBe(true);
          }
        } catch {
          expect(nonActive.statusLabel).toMatch(/Radiată|Inactiv|Suspendat/);
        }
      }
    }, 30000);
  });

  describe('SOLR Data Verification', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should have ASSIST SOFTWARE jobs in SOLR with correct company name', async () => {
      const result = await solr.querySOLR(TEST_CIF);

      expect(result.numFound).toBeGreaterThan(0);

      for (const job of result.docs) {
        expect(job.company).toBe('ASSIST SOFTWARE SRL');
        expect(job.cif).toBe(TEST_CIF);
      }
    }, 15000);

    itIfSolr('should have ASSIST SOFTWARE company core entry with required fields', async () => {
      const result = await solr.queryCompanySOLR(`id:${TEST_CIF}`);

      expect(result.numFound).toBe(1);
      const assist = result.docs[0];
      expect(assist.company).toBe('ASSIST SOFTWARE SRL');
      expect(assist.status).toBe('activ');
    }, 15000);
  });
});
