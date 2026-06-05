# Robots.txt Analysis — assist-software.net

Sursa: https://assist-software.net/robots.txt

## Reguli

```
User-agent: *
Disallow: /admin/
Disallow: /tools/
Allow: /
```

## Interpretare

| Cale | Accesibil? | Ce conține |
|---|---|---|
| `/` | ✅ Da | Pagina principală |
| `/jobs` | ✅ Da | Lista de job-uri |
| `/jobs/*` | ✅ Da | Pagini individuale de job |
| `/admin/*` | ❌ Disallowed | Admin |
| `/tools/*` | ❌ Disallowed | Tools |

## Recomandare

- Scraperul accesează doar `/jobs` și paginile individuale — permise de robots.txt
- Rate limiting: 1 request per page, delay rezonabil
- User-Agent standard de browser
- Riscul de blocare este minim
