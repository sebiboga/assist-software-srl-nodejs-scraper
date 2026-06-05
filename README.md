# ASSIST SOFTWARE SRL — Job Scraper

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-24.x-green.svg)
![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-orange.svg)

**job_seeker_ro_spider** — web scraper pentru a aduce locurile de munca de la **ASSIST SOFTWARE** in platforma [peviitor.ro](https://peviitor.ro).

## Despre

Acest scraper extrage zilnic anunturile de angajare de pe [assist-software.net/jobs](https://assist-software.net/jobs) si le publica in platforma peviitor.ro prin API-ul SOLR.

## Cum functioneaza

| Pas | Actiune | API/Sursa |
|-----|---------|-----------|
| 1 | Valideaza compania in ANAF | [demoanaf.ro](https://demoanaf.ro) |
| 2 | Cross-valideaza in Peviitor | [api.peviitor.ro](https://api.peviitor.ro) |
| 3 | Extrage job-urile din HTML | [assist-software.net/jobs](https://assist-software.net/jobs) |
| 4 | Parseaza si filtreaza | Cheerio HTML parsing |
| 5 | Extrage tag-uri tech | Pagini individuale de job |
| 6 | Trimite la SOLR | [solr.peviitor.ro](https://solr.peviitor.ro) |

## Tech Stack

- **Node.js 24** — Runtime
- **Cheerio** — HTML parsing
- **GitHub Actions** — CI/CD

## Instalare

```bash
git clone https://github.com/sebiboga/assist-software-srl-nodejs-scraper.git
cd assist-software-srl-nodejs-scraper
npm install
```

## Utilizare

```bash
# Ruleaza scraperul
npm run scrape

# Ruleaza testele
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
```

## GitHub Actions

| Workflow | Schedule | Runner |
|----------|----------|--------|
| **Scrape** | Zilnic la 6 AM | `ubuntu-latest` |
| **Tests** | La fiecare push/PR | `ubuntu-latest` |
| **Pages** | La fiecare push pe main | `ubuntu-latest` |

## Structura proiect

```
.
├── index.js              # Orchestrator principal
├── company.js            # Validare companie (ANAF + Peviitor + SOLR)
├── src/anaf.js           # Modul ANAF API
├── solr.js               # Operatii SOLR
├── package.json
├── .github/workflows/
│   ├── scrape.yml        # Scraper principal
│   ├── test.yml          # Teste automate
│   └── deploy.yml        # GitHub Pages deploy
├── tests/
│   ├── unit/             # Teste unitare
│   ├── integration/      # Teste de integrare
│   └── e2e/              # Teste end-to-end
└── docs/
    └── index.html        # GitHub Pages site
```

## License

MIT License — Copyright (c) 2026 BOGA SEBASTIAN-NICOLAE

## Autor

**Boga Sebastian-Nicolae**
- GitHub: [@sebiboga](https://github.com/sebiboga)
- LinkedIn: [sebastianboga](https://linkedin.com/in/sebastianboga)
- Website: [peviitor.ro](https://peviitor.ro)
