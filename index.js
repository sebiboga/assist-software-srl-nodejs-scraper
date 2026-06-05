import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs";
import { fileURLToPath } from "url";
import { validateAndGetCompany } from "./company.js";
import { querySOLR, deleteJobByUrl, upsertJobs, upsertCompany } from "./solr.js";

const COMPANY_CIF = "2693736";

const TIMEOUT = 10000;

const JOB_BASE = "https://assist-software.net";

let COMPANY_NAME = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KNOWN_TAGS = [
  "Go", "Golang", "Java", "Python", "JavaScript", "TypeScript", "Node.js", "Node",
  "React", "Angular", "Vue", "Next.js", "Nuxt",
  "C#", ".NET", ".Net", "C++", "Rust", "Ruby", "PHP", "Scala", "Kotlin", "Swift",
  "MySQL", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch", "Cassandra", "MariaDB",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "CI/CD", "Jenkins",
  "Git", "Linux", "REST", "GraphQL", "gRPC", "Microservices",
  "HTML", "CSS", "Sass", "Tailwind", "Bootstrap",
  "Spring", "Spring Boot", "Hibernate", "JPA", "Jakarta",
  "Express", "Fastify", "NestJS", "Django", "Flask", "FastAPI", "Laravel", "Symfony",
  "Android", "iOS", "React Native", "Flutter", "Unity",
  "Machine Learning", "AI", "Deep Learning", "NLP", "TensorFlow", "PyTorch",
  "Kafka", "RabbitMQ", "ActiveMQ", "NATS",
  "Prometheus", "Grafana", "Datadog", "New Relic",
  "Agile", "Scrum", "Kanban", "Jira", "Confluence"
];

async function fetchJobsPage(pageNum) {
  const url = `${JOB_BASE}/jobs?page=${pageNum}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "job_seeker_ro_spider",
      "Accept": "text/html"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP error ${res.status} for page=${pageNum}`);
  }

  return await res.text();
}

function parseJobsPage(html) {
  const $ = cheerio.load(html);
  const jobs = [];

  $('div.group.flex.flex-col.items-start.justify-between.rounded-md').each((_, el) => {
    const $el = $(el);

    const titleEl = $el.find('div.text-2xl-res.font-500').first();
    let title = titleEl.text().trim();
    title = title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();

    const linkEl = $el.find('a[href*="/jobs/"]').first();
    let relPath = linkEl.attr('href') || '';
    const url = relPath.startsWith('http') ? relPath : `${JOB_BASE}${relPath}`;

    const badges = $el.find('div.w-fit.rounded-full.border-1.border-neutral-500');
    let workmode = "hybrid";
    if (badges.length >= 2) {
      const modeText = $(badges[1]).text().trim().toLowerCase();
      if (modeText.includes("remote") && !modeText.includes("office")) {
        workmode = "remote";
      } else if (modeText.includes("office") && !modeText.includes("remote")) {
        workmode = "on-site";
      } else if (modeText.includes("remote") && modeText.includes("office")) {
        workmode = "hybrid";
      } else if (modeText.includes("remote")) {
        workmode = "remote";
      } else if (modeText.includes("office") || modeText.includes("on-site")) {
        workmode = "on-site";
      }
    }

    if (title && url) {
      jobs.push({
        url,
        title,
        workmode,
        location: ["Suceava"]
      });
    }
  });

  return jobs;
}

async function fetchJobTags(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "job_seeker_ro_spider",
        "Accept": "text/html"
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseJobTags(html);
  } catch {
    return [];
  }
}

function parseJobTags(html) {
  const $ = cheerio.load(html);
  const allText = $('li.leading-20px').map((_, el) => $(el).text()).get().join(" ");
  const lowercaseText = allText.toLowerCase();
  const found = [];
  for (const tag of KNOWN_TAGS) {
    const lowerTag = tag.toLowerCase();
    const firstChar = lowerTag[0];
    if (/[a-z0-9]/.test(firstChar)) {
      const escaped = lowerTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(lowercaseText)) {
        found.push(lowerTag);
      }
    } else if (lowercaseText.includes(lowerTag)) {
      found.push(lowerTag);
    }
  }
  return [...new Set(found)];
}

async function scrapeAllListings(testOnlyOnePage = false) {
  const allJobs = [];
  const seenUrls = new Set();
  let page = 0;
  const MAX_PAGES = 5;

  while (true) {
    console.log(`Fetching page: ${page}`);
    const html = await fetchJobsPage(page);
    const jobs = parseJobsPage(html);

    if (!jobs.length) {
      console.log(`No jobs found on page ${page}, stopping.`);
      break;
    }

    let newJobs = 0;
    for (const job of jobs) {
      if (!seenUrls.has(job.url)) {
        seenUrls.add(job.url);
        allJobs.push(job);
        newJobs++;
      }
    }
    console.log(`Page ${page}: ${jobs.length} jobs, ${newJobs} new (total: ${allJobs.length})`);

    if (testOnlyOnePage) {
      console.log("Test mode: stopping after page 0.");
      break;
    }

    if (page >= MAX_PAGES) {
      console.log(`Max pages (${MAX_PAGES}) reached, stopping.`);
      break;
    }

    if (newJobs === 0) {
      console.log(`No new jobs on page ${page}, stopping.`);
      break;
    }

    page += 1;
    await sleep(1000);
  }

  console.log(`Total unique jobs collected: ${allJobs.length}`);

  if (!testOnlyOnePage && allJobs.length > 0) {
    console.log("\nFetching tags from job detail pages...");
    for (let i = 0; i < allJobs.length; i++) {
      const job = allJobs[i];
      console.log(`  [${i + 1}/${allJobs.length}] ${job.title}`);
      const tags = await fetchJobTags(job.url);
      if (tags.length > 0) {
        job.tags = tags;
        console.log(`    tags: ${tags.join(", ")}`);
      }
      await sleep(500);
    }
  }

  return allJobs;
}

function mapToJobModel(rawJob, cif, companyName = COMPANY_NAME) {
  const now = new Date().toISOString();

  const job = {
    url: rawJob.url,
    title: rawJob.title,
    company: companyName,
    cif: cif,
    location: rawJob.location?.length ? rawJob.location : undefined,
    workmode: rawJob.workmode || undefined,
    date: now,
    status: "scraped"
  };

  Object.keys(job).forEach((k) => job[k] === undefined && delete job[k]);

  return job;
}

function transformJobsForSOLR(payload) {
  const normalizeWorkmode = (wm) => {
    if (!wm) return undefined;
    const lower = wm.toLowerCase();
    if (lower.includes('remote') && !lower.includes('office')) return 'remote';
    if ((lower.includes('office') || lower.includes('on-site')) && !lower.includes('remote')) return 'on-site';
    if (lower.includes('remote') || lower.includes('office')) return 'hybrid';
    return 'hybrid';
  };

  const transformed = {
    ...payload,
    company: payload.company?.toUpperCase(),
    jobs: payload.jobs.map(job => {
      return {
        ...job,
        workmode: normalizeWorkmode(job.workmode)
      };
    })
  };

  return transformed;
}

async function main() {
  const testOnlyOnePage = process.argv.includes("--test");

  try {
    console.log("=== Step 1: Get existing jobs count ===");
    const existingResult = await querySOLR(COMPANY_CIF);
    const existingCount = existingResult.numFound;
    console.log(`Found ${existingCount} existing jobs in SOLR`);
    console.log("(Keeping existing jobs - will upsert ASSIST SOFTWARE jobs only)");

    console.log("=== Step 2: Validate company via ANAF ===");
    const { company, cif, address } = await validateAndGetCompany();
    COMPANY_NAME = company;
    const localCif = cif;

    try {
      await upsertCompany({
        id: cif,
        company,
        brand: "ASSIST SOFTWARE",
        status: "activ",
        location: address ? [address] : ["Suceava"],
        website: ["https://assist-software.net"],
        career: ["https://assist-software.net/jobs"],
        lastScraped: new Date().toISOString().split('T')[0],
        scraperFile: "https://raw.githubusercontent.com/sebiboga/assist-software-srl-nodejs-scraper/main/.github/workflows/scrape.yml"
      });
    } catch (err) {
      console.log(`Note: Could not upsert company to SOLR core: ${err.message}`);
    }

    const rawJobs = await scrapeAllListings(testOnlyOnePage);
    const scrapedCount = rawJobs.length;
    console.log(`📊 Jobs scraped from ASSIST SOFTWARE website: ${scrapedCount}`);

    const jobs = rawJobs.map(job => mapToJobModel(job, localCif));

    const payload = {
      source: "assist-software.net",
      scrapedAt: new Date().toISOString(),
      company: COMPANY_NAME,
      cif: localCif,
      jobs
    };

    console.log("Transforming jobs for SOLR...");
    const transformedPayload = transformJobsForSOLR(payload);
    console.log(`📊 Jobs count: ${transformedPayload.jobs.length}`);

    fs.mkdirSync("tmp", { recursive: true });
    fs.writeFileSync("tmp/jobs.json", JSON.stringify(transformedPayload, null, 2), "utf-8");
    console.log("Saved tmp/jobs.json");

    console.log("\n=== Step 4: Upsert jobs to SOLR ===");
    await upsertJobs(transformedPayload.jobs);

    const finalResult = await querySOLR(COMPANY_CIF);
    console.log(`\n📊 === SUMMARY ===`);
    console.log(`📊 Jobs existing in SOLR before scrape: ${existingCount}`);
    console.log(`📊 Jobs scraped from ASSIST website: ${scrapedCount}`);
    console.log(`📊 Jobs in SOLR after scrape: ${finalResult.numFound}`);
    console.log(`====================`);

    console.log("\n=== DONE ===");
    console.log("Scraper completed successfully!");

  } catch (err) {
    console.error("Scraper failed:", err);
    process.exit(1);
  }
}

export { parseJobsPage, parseJobTags, fetchJobTags, mapToJobModel, transformJobsForSOLR };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
