import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const HAS_SOLR = !!process.env.SOLR_AUTH;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) return it(name, fn, timeout);
  return it.skip(`${name} (skipped: SOLR_AUTH not set)`, fn, timeout);
}

const ASSIST_CIF = '2693736';
const ASSIST_COMPANY = 'ASSIST SOFTWARE SRL';
const ASSIST_BRAND = 'ASSIST SOFTWARE';

beforeAll(() => {
  try { fs.unlinkSync('tmp/company.json'); } catch {}
  if (HAS_SOLR) process.env.SOLR_AUTH = process.env.SOLR_AUTH;
});

describe('Integration: Scraper', () => {

  describe('Company Validation', () => {
    let company;
    beforeAll(async () => { company = await import('../../company.js'); });

    it('should validate company data from ANAF', async () => {
      const d = await company.getCompanyData();
      expect(d).toHaveProperty('company', ASSIST_COMPANY);
      expect(d).toHaveProperty('cif', ASSIST_CIF);
      expect(d).toHaveProperty('active', true);
    }, 30000);

    it('should load company from cache', async () => {
      fs.mkdirSync('tmp', { recursive: true });
      fs.writeFileSync('tmp/company.json', JSON.stringify({ summary: { company: ASSIST_COMPANY, cif: ASSIST_CIF, active: true }, anaf: { name: ASSIST_COMPANY, cui: parseInt(ASSIST_CIF) } }));
      const d = await company.getCompanyData();
      expect(d.company).toBe(ASSIST_COMPANY);
    }, 15000);

    it('should detect inactive company', async () => {
      const anaf = await import('../../src/anaf.js');
      const r = await anaf.getCompanyFromANAFWithFallback('99999999', { cui: 99999999, name: 'X', inactive: true });
      expect(r.inactive).toBe(true);
    }, 15000);
  });

  describe('Index Module Exports', () => {
    let index;
    beforeAll(async () => { index = await import('../../index.js'); });

    it('exports parseJobsPage', () => expect(typeof index.parseJobsPage).toBe('function'));
    it('exports mapToJobModel', () => expect(typeof index.mapToJobModel).toBe('function'));
    it('exports transformJobsForSOLR', () => expect(typeof index.transformJobsForSOLR).toBe('function'));
  });

  describe('SOLR Indexing', () => {
    let solr;
    beforeAll(async () => { solr = await import('../../solr.js'); });

    itIfSolr('should add and remove test jobs', async () => {
      const jobs = [{ url: 'https://assist-software.net/jobs/test', title: 'Test', company: ASSIST_COMPANY, city: 'Suceava', county: 'Suceava', country: 'Romania', remote: [], published: new Date().toISOString().split('T')[0] }];
      let r = await solr.upsertJobs(jobs);
      expect(r.status).toBe(0);
      r = await solr.deleteJobByUrl('https://assist-software.net/jobs/test');
      expect(r.status).toBe(0);
    }, 15000);
  });

  describe('Full Verification', () => {
    itIfSolr('should verify company in SOLR', async () => {
      const solr = await import('../../solr.js');
      const r = await solr.queryCompanySOLR(`id:${ASSIST_CIF}`);
      expect(r.numFound).toBe(1);
      expect(r.docs[0].company).toBe(ASSIST_COMPANY);
    }, 15000);
  });
});
