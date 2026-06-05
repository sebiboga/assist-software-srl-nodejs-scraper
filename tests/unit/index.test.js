import { jest } from '@jest/globals';

describe('index.js Component Tests', () => {
  let index;

  beforeAll(async () => {
    index = await import('../../index.js');
  });

  describe('transformJobsForSOLR', () => {
    it('should keep company uppercase', () => {
      const payload = {
        source: 'assist-software.net',
        company: 'assist software srl',
        cif: '2693736',
        jobs: [
          { url: 'https://assist-software.net/jobs/test', title: 'Job 1', company: 'assist software', cif: '2693736' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.company).toBe('ASSIST SOFTWARE SRL');
    });

    it('should normalize workmode values', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', workmode: 'remote' },
          { url: 'https://test.com/2', title: 'Job 2', workmode: 'on-site' },
          { url: 'https://test.com/3', title: 'Job 3', workmode: 'hybrid' },
          { url: 'https://test.com/4', title: 'Job 4', workmode: 'hybrid' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].workmode).toBe('remote');
      expect(result.jobs[1].workmode).toBe('on-site');
      expect(result.jobs[2].workmode).toBe('hybrid');
      expect(result.jobs[3].workmode).toBe('hybrid');
    });

    it('should handle empty jobs array', () => {
      const result = index.transformJobsForSOLR({ jobs: [] });
      expect(result.jobs).toEqual([]);
    });
  });

  describe('mapToJobModel', () => {
    it('should map raw job to job model format', () => {
      const rawJob = {
        url: 'https://assist-software.net/jobs/test',
        title: 'Golang Developer',
        location: ['Suceava'],
        workmode: 'hybrid'
      };

      const COMPANY_NAME = 'ASSIST SOFTWARE SRL';
      const COMPANY_CIF = '2693736';

      const result = index.mapToJobModel(rawJob, COMPANY_CIF, COMPANY_NAME);

      expect(result.url).toBe(rawJob.url);
      expect(result.title).toBe(rawJob.title);
      expect(result.company).toBe(COMPANY_NAME);
      expect(result.cif).toBe(COMPANY_CIF);
      expect(result.location).toEqual(rawJob.location);
      expect(result.workmode).toBe(rawJob.workmode);
      expect(result.status).toBe('scraped');
      expect(result.date).toBeDefined();
    });

    it('should remove undefined fields', () => {
      const rawJob = {
        url: 'https://test.com/1',
        title: 'Job 1'
      };

      const result = index.mapToJobModel(rawJob, '2693736');

      expect(result.location).toBeUndefined();
      expect(result.workmode).toBeUndefined();
    });

    it('should handle missing title', () => {
      const rawJob = { url: 'https://test.com/1' };

      const result = index.mapToJobModel(rawJob, '2693736');

      expect(result.title).toBeUndefined();
      expect(result.url).toBe('https://test.com/1');
    });
  });

  describe('parseJobsPage', () => {
    it('should return empty array for empty HTML', () => {
      const result = index.parseJobsPage('<html></html>');
      expect(result).toEqual([]);
    });

    it('should return empty array for HTML with no job listings', () => {
      const result = index.parseJobsPage('<html><body><div>No jobs here</div></body></html>');
      expect(result).toEqual([]);
    });

    it('should parse a single job card correctly', () => {
      const html = `
        <div class="group flex flex-col items-start justify-between rounded-md border-1 border-neutral-300 p-7 hover:shadow-xl hover:transition-all">
          <div>
            <div class="text-2xl-res font-500 group-hover:text-primary-500">Golang Developer</div>
            <div class="mt-7 flex flex-col flex-wrap gap-4 lg:flex-row">
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">2+ years of experience</div>
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">Remote or Office</div>
            </div>
          </div>
          <a class="..." href="/jobs/golang-developer">Read more</a>
        </div>
      `;

      const result = index.parseJobsPage(html);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Golang Developer');
      expect(result[0].url).toBe('https://assist-software.net/jobs/golang-developer');
      expect(result[0].workmode).toBe('hybrid');
      expect(result[0].location).toEqual(['Suceava']);
    });

    it('should detect remote work mode correctly', () => {
      const html = `
        <div class="group flex flex-col items-start justify-between rounded-md border-1 border-neutral-300 p-7 hover:shadow-xl hover:transition-all">
          <div>
            <div class="text-2xl-res font-500 group-hover:text-primary-500">Remote Job</div>
            <div class="mt-7 flex flex-col flex-wrap gap-4 lg:flex-row">
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">5+ years of experience</div>
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">Remote</div>
            </div>
          </div>
          <a class="..." href="/jobs/remote-job">Read more</a>
        </div>
      `;

      const result = index.parseJobsPage(html);

      expect(result).toHaveLength(1);
      expect(result[0].workmode).toBe('remote');
    });

    it('should detect on-site work mode correctly', () => {
      const html = `
        <div class="group flex flex-col items-start justify-between rounded-md border-1 border-neutral-300 p-7 hover:shadow-xl hover:transition-all">
          <div>
            <div class="text-2xl-res font-500 group-hover:text-primary-500">Office Job</div>
            <div class="mt-7 flex flex-col flex-wrap gap-4 lg:flex-row">
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">2+ years of experience</div>
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">Office</div>
            </div>
          </div>
          <a class="..." href="/jobs/office-job">Read more</a>
        </div>
      `;

      const result = index.parseJobsPage(html);

      expect(result).toHaveLength(1);
      expect(result[0].workmode).toBe('on-site');
    });

    it('should strip emoji characters from title', () => {
      const html = `
        <div class="group flex flex-col items-start justify-between rounded-md border-1 border-neutral-300 p-7 hover:shadow-xl hover:transition-all">
          <div>
            <div class="text-2xl-res font-500 group-hover:text-primary-500">Golang Developer🔥</div>
            <div class="mt-7 flex flex-col flex-wrap gap-4 lg:flex-row">
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">2+ years of experience</div>
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">Remote or Office</div>
            </div>
          </div>
          <a class="..." href="/jobs/golang-developer">Read more</a>
        </div>
      `;

      const result = index.parseJobsPage(html);

      expect(result[0].title).toBe('Golang Developer');
    });

    it('should parse multiple job cards', () => {
      const html = `
        <div class="group flex flex-col items-start justify-between rounded-md border-1 border-neutral-300 p-7 hover:shadow-xl hover:transition-all">
          <div>
            <div class="text-2xl-res font-500 group-hover:text-primary-500">Job A</div>
            <div class="mt-7 flex flex-col flex-wrap gap-4 lg:flex-row">
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">Experience</div>
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">Remote or Office</div>
            </div>
          </div>
          <a class="..." href="/jobs/job-a">Read more</a>
        </div>
        <div class="group flex flex-col items-start justify-between rounded-md border-1 border-neutral-300 p-7 hover:shadow-xl hover:transition-all">
          <div>
            <div class="text-2xl-res font-500 group-hover:text-primary-500">Job B</div>
            <div class="mt-7 flex flex-col flex-wrap gap-4 lg:flex-row">
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">Experience</div>
              <div class="w-fit rounded-full border-1 border-neutral-500 p-2 text-14px font-500 leading-20px text-primary-900">Remote</div>
            </div>
          </div>
          <a class="..." href="/jobs/job-b">Read more</a>
        </div>
      `;

      const result = index.parseJobsPage(html);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Job A');
      expect(result[1].title).toBe('Job B');
      expect(result[0].workmode).toBe('hybrid');
      expect(result[1].workmode).toBe('remote');
    });
  });

  describe('parseJobTags', () => {
    it('should return empty array for HTML with no job description', () => {
      const result = index.parseJobTags('<html></html>');
      expect(result).toEqual([]);
    });

    it('should extract known tech tags from job description', () => {
      const html = `
        <html>
          <ul>
            <li class="leading-20px">Design and develop backend services in Go</li>
            <li class="leading-20px">Experience with MySQL and Redis</li>
            <li class="leading-20px">Build REST APIs</li>
            <li class="leading-20px">Work with AWS cloud platform</li>
            <li class="leading-20px">CI/CD pipelines with Docker and Kubernetes</li>
          </ul>
        </html>
      `;

      const result = index.parseJobTags(html);

      expect(result).toContain('go');
      expect(result).toContain('mysql');
      expect(result).toContain('redis');
      expect(result).toContain('rest');
      expect(result).toContain('aws');
      expect(result).toContain('ci/cd');
      expect(result).toContain('docker');
      expect(result).toContain('kubernetes');
    });

    it('should return unique tags only', () => {
      const html = `
        <html>
          <ul>
            <li class="leading-20px">Strong Java skills with Spring Boot</li>
            <li class="leading-20px">Expert Java developer</li>
            <li class="leading-20px">Spring and Hibernate experience</li>
          </ul>
        </html>
      `;

      const result = index.parseJobTags(html);

      const javaCount = result.filter(t => t === 'java').length;
      expect(javaCount).toBe(1);
      expect(result).toContain('spring');
      expect(result).toContain('spring boot');
      expect(result).toContain('hibernate');
    });

    it('should not extract non-tech words as tags', () => {
      const html = `
        <html>
          <ul>
            <li class="leading-20px">Great communication skills</li>
            <li class="leading-20px">Team player mentality</li>
            <li class="leading-20px">Problem-solving abilities</li>
          </ul>
        </html>
      `;

      const result = index.parseJobTags(html);

      expect(result).toEqual([]);
    });
  });
});
