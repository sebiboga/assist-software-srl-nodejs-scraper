#!/usr/bin/env node
import fetch from "node-fetch";
const CIF = "2693736";
const COMPANY = "ASSIST SOFTWARE SRL";
const AUTH = process.env.SOLR_AUTH;
if (!AUTH) { console.log("SOLR_AUTH not set"); process.exit(0); }
const r = await (await fetch(`https://solr.peviitor.ro/solr/job/select?q=cif:${CIF}&rows=100&wt=json`, { headers: { "Authorization": "Basic " + Buffer.from(AUTH).toString("base64") } })).json();
const docs = r.response.docs;
console.log(`Found ${docs.length} jobs`);
let errors = 0;
for (const j of docs) {
  if (j.cif !== CIF) { console.log(`❌ CIF mismatch`); errors++; }
  if (!j.url) { console.log(`❌ Missing URL`); errors++; }
}
if (errors === 0) console.log("✅ All validations passed!");
process.exit(errors > 0 ? 1 : 0);
