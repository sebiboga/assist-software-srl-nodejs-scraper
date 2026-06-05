# Instructions

## Project Purpose

This scraper extracts job listings from ASSIST SOFTWARE careers page and imports them to peviitor.ro.

Target: https://assist-software.net/jobs

## Technologies

- **Node.js & JavaScript** - For scraping and data extraction
- **Apache SOLR** - For data storage and indexing

## Workflow Steps

1. **Start with brand** - ASSIST SOFTWARE
2. **Search in DemoANAF** - Find company by brand
3. **Get company details from ANAF** - Using CIF 2693736
4. **Validate with Peviitor** - Verify company exists
5. **Check existing jobs in SOLR**
6. **Check company status** - If inactive, stop
7. **Scrape jobs page** - Extract job listings from HTML
8. **Scrape each job page** - Parse tags from detail pages
9. **Transform for SOLR** - Normalize locations, fields
10. **Upsert to SOLR**

## API Endpoints

- **DemoANAF Search**: `https://demoanaf.ro/api/search?q=BRAND`
- **DemoANAF Company**: `https://demoanaf.ro/api/company/:cui`
- **Peviitor API**: `https://api.peviitor.ro/v1/company/`
- **Solr**: `https://solr.peviitor.ro/solr/job` (auth: `SOLR_AUTH`)
