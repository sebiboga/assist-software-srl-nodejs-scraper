# job_seeker_ro_spider

**job_seeker_ro_spider** — scraper pentru job-urile ASSIST SOFTWARE (ASSIST SOFTWARE SRL) din România.

Extrage anunțurile de pe [ASSIST SOFTWARE Jobs](https://assist-software.net/jobs) și le publică în [peviitor.ro](https://peviitor.ro).

## Ce face

1. **Validează compania** — interoghează API-ul ANAF după brand ASSIST SOFTWARE
2. **Cross-validează cu Peviitor** — verifică existența în API-ul Peviitor
3. **Scrape-uiește paginile de job-uri** — extrage lista de job-uri din HTML
4. **Parsează tag-uri din paginile de detaliu** — extrage tech stack
5. **Stochează în SOLR**

## Structură proiect

```
├── index.js           # Orchestrator principal
├── company.js         # Validare companie
├── src/anaf.js        # Modul ANAF API
├── solr.js            # Operații SOLR
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── .github/workflows/
    ├── scrape.yml     # Rulează zilnic la 6 AM
    └── test.yml       # Teste la fiecare push/PR
```

## Testare

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
```
