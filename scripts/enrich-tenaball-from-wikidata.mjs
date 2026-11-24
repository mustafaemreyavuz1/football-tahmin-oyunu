#!/usr/bin/env node
/**
 * Looks up any TenaBall answer names missing from src/data/guessPool.json
 * using Wikipedia batch QID resolution (50 titles/request) + Wikidata SPARQL verification
 * (strictly requiring wdt:P106 wd:Q937857 = association football player).
 * Never invents players; anything not verified on Wikidata is reported as missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../src/data');
const ENWIKI_API = 'https://en.wikipedia.org/w/api.php';
const WB_API = 'https://www.wikidata.org/w/api.php';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'FootballTahminOyunu/1.0 (https://github.com/hobby/football-tahmin-oyunu; hobby trivia app)';

const CHAR_MAP = {
  ı: 'i', İ: 'i', I: 'i', ğ: 'g', Ğ: 'g', ş: 's', Ş: 's',
  ç: 'c', Ç: 'c', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u',
  ø: 'o', Ø: 'o', đ: 'd', Đ: 'd', ł: 'l', Ł: 'l',
  ß: 'ss', æ: 'ae', Æ: 'ae', œ: 'oe', Œ: 'oe',
};

function normalizeText(input) {
  if (!input) return '';
  let out = '';
  for (const ch of input) out += CHAR_MAP[ch] ?? ch;
  return out
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`´.-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(str) {
  return normalizeText(str).replace(/\s+/g, '-');
}

const SURNAME_PARTICLES = new Set([
  'de', 'del', 'di', 'da', 'dos', 'das', 'van', 'von',
  'der', 'den', 'ter', 'el', 'al', 'mac', 'mc', 'la', 'le', 'st', 'san',
]);

function extractSurname(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return fullName.trim();
  const res = [parts[parts.length - 1]];
  let i = parts.length - 2;
  while (i >= 1 && SURNAME_PARTICLES.has(normalizeText(parts[i]))) {
    res.unshift(parts[i]);
    i -= 1;
  }
  return res.join(' ');
}

function mapPositionToTurkish(rawPos) {
  const p = (rawPos || '').toLowerCase();
  if (!p) return 'Orta Saha';
  if (p.includes('goalkeeper') || p.includes('kaleci')) return 'Kaleci';
  if (p.includes('defender') || p.includes('back') || p.includes('sweeper') || p.includes('defans')) return 'Defans';
  if (p.includes('forward') || p.includes('striker') || p.includes('winger') || p.includes('forvet')) return 'Forvet';
  return 'Orta Saha';
}

const COUNTRY_TR_MAP = {
  Turkey: 'Türkiye', England: 'İngiltere', 'United Kingdom': 'İngiltere', Spain: 'İspanya',
  France: 'Fransa', Germany: 'Almanya', Italy: 'İtalya', Brazil: 'Brezilya',
  Argentina: 'Arjantin', Portugal: 'Portekiz', Netherlands: 'Hollanda',
  'Kingdom of the Netherlands': 'Hollanda', Belgium: 'Belçika', Croatia: 'Hırvatistan',
  Uruguay: 'Uruguay', Poland: 'Polonya', Sweden: 'İsveç', Norway: 'Norveç',
  Denmark: 'Danimarka', Switzerland: 'İsviçre', Austria: 'Avusturya', Serbia: 'Sırbistan',
  Ukraine: 'Ukrayna', Colombia: 'Kolombiya', Chile: 'Şili', Mexico: 'Meksika',
  'United States': 'ABD', Canada: 'Kanada', Japan: 'Japonya', 'South Korea': 'Güney Kore',
  Egypt: 'Mısır', Morocco: 'Fas', Nigeria: 'Nijerya', Senegal: 'Senegal',
  'Ivory Coast': 'Fildişi Sahili', "Côte d'Ivoire": 'Fildişi Sahili', Cameroon: 'Kamerun',
  Ghana: 'Gana', Algeria: 'Cezayir', Greece: 'Yunanistan', Romania: 'Romanya',
  Scotland: 'İskoçya', Wales: 'Galler', Ireland: 'İrlanda', 'Republic of Ireland': 'İrlanda',
  'Czech Republic': 'Çekya', Czechia: 'Çekya', Hungary: 'Macaristan', Slovakia: 'Slovakya',
  Slovenia: 'Slovenya', 'Bosnia and Herzegovina': 'Bosna-Hersek', Georgia: 'Gürcistan',
  Russia: 'Rusya', Ecuador: 'Ekvador', Paraguay: 'Paraguay', Peru: 'Peru',
  Venezuela: 'Venezuela', 'Costa Rica': 'Kosta Rika', Australia: 'Avustralya',
  Bulgaria: 'Bulgaristan', 'DR Congo': 'Kongo DC', 'Democratic Republic of the Congo': 'Kongo DC',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runSparql(query) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`SPARQL HTTP ${res.status}`);
  const data = await res.json();
  return data.results.bindings;
}

/**
 * Batch-resolves player names to Wikidata QIDs via en.wikipedia.org pageprops (50 titles per call).
 */
async function resolveViaEnWiki(names) {
  const qidToOriginal = new Map();
  const stillMissing = [];

  for (let i = 0; i < names.length; i += 45) {
    const batch = names.slice(i, i + 45);
    const url = `${ENWIKI_API}?action=query&titles=${encodeURIComponent(batch.join('|'))}&prop=pageprops&ppprop=wikibase_item|disambiguation&redirects=1&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      stillMissing.push(...batch);
      continue;
    }
    const data = await res.json();
    const normMap = new Map();
    for (const n of data.query?.normalized || []) normMap.set(n.from, n.to);
    const redirMap = new Map();
    for (const r of data.query?.redirects || []) redirMap.set(r.from, r.to);
    const pageByTitle = new Map();
    for (const pg of Object.values(data.query?.pages || {})) pageByTitle.set(pg.title, pg);

    const retryFootballer = [];
    for (const rawName of batch) {
      let t = normMap.get(rawName) || rawName;
      t = redirMap.get(t) || t;
      const pg = pageByTitle.get(t);
      const qid = pg?.pageprops?.wikibase_item;
      const isDisambig = pg?.pageprops && 'disambiguation' in pg.pageprops;
      if (qid && !('missing' in pg) && !isDisambig) {
        qidToOriginal.set(qid, rawName);
      } else {
        retryFootballer.push(rawName);
      }
    }

    // Retry disambiguation / missing titles with " (footballer)" suffix
    if (retryFootballer.length > 0) {
      const altTitles = retryFootballer.map((n) => `${n} (footballer)`);
      const altUrl = `${ENWIKI_API}?action=query&titles=${encodeURIComponent(altTitles.join('|'))}&prop=pageprops&ppprop=wikibase_item|disambiguation&redirects=1&format=json`;
      const altRes = await fetch(altUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (altRes.ok) {
        const altData = await altRes.json();
        const aNorm = new Map();
        for (const n of altData.query?.normalized || []) aNorm.set(n.from, n.to);
        const aRedir = new Map();
        for (const r of altData.query?.redirects || []) aRedir.set(r.from, r.to);
        const aPages = new Map();
        for (const pg of Object.values(altData.query?.pages || {})) aPages.set(pg.title, pg);

        for (const rawName of retryFootballer) {
          let t = aNorm.get(`${rawName} (footballer)`) || `${rawName} (footballer)`;
          t = aRedir.get(t) || t;
          const pg = aPages.get(t);
          const qid = pg?.pageprops?.wikibase_item;
          const isDisambig = pg?.pageprops && 'disambiguation' in pg.pageprops;
          if (qid && !('missing' in pg) && !isDisambig) {
            qidToOriginal.set(qid, rawName);
          } else {
            stillMissing.push(rawName);
          }
        }
      } else {
        stillMissing.push(...retryFootballer);
      }
    }
    await sleep(150);
  }

  return { qidToOriginal, stillMissing };
}

/**
 * Fallback sequential polite wbsearchentities for names that didn't match exact enwiki titles
 * (e.g. "Cafu Evangelista" -> search "Cafu", "Hulk Paraíba" -> search "Hulk footballer").
 */
async function resolveViaWbSearch(names) {
  const qidToOriginal = new Map();
  const stillMissing = [];

  for (const rawName of names) {
    const attempts = [rawName, `${rawName.split(' ')[0]} footballer`, rawName.split(' ')[0]];
    let matchedQid = null;

    for (const q of attempts) {
      try {
        const url = `${WB_API}?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&format=json&limit=5&type=item`;
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) {
          await sleep(400);
          continue;
        }
        const data = await res.json();
        const hit = (data.search || []).find((c) =>
          /football|soccer|goalkeeper|striker|midfielder|defender/i.test(c.description || '')
        );
        if (hit?.id) {
          matchedQid = hit.id;
          break;
        }
        await sleep(150);
      } catch {
        await sleep(300);
      }
    }

    if (matchedQid) {
      qidToOriginal.set(matchedQid, rawName);
    } else {
      stillMissing.push(rawName);
    }
  }

  return { qidToOriginal, stillMissing };
}

async function main() {
  const tenaball = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'tenaball.json'), 'utf8'));
  const guessPoolFile = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'guessPool.json'), 'utf8'));
  const puzzlePoolFile = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'puzzlePool.json'), 'utf8'));

  const existingNorm = new Set(guessPoolFile.rows.map((r) => normalizeText(r[1])));
  const usedIds = new Set(guessPoolFile.rows.map((r) => r[0]));

  const missingMap = new Map();
  for (const q of tenaball) {
    for (const ans of q.answers) {
      const k = normalizeText(ans);
      if (!existingNorm.has(k) && !missingMap.has(k)) {
        missingMap.set(k, ans);
      }
    }
  }

  const missingNames = Array.from(missingMap.values());
  console.log(`Missing TenaBall answers before enrichment: ${missingNames.length}`);
  if (missingNames.length === 0) return;

  // Step 1: Fast batch Wikipedia QID lookup
  const { qidToOriginal, stillMissing } = await resolveViaEnWiki(missingNames);
  console.log(`Resolved via en.wikipedia batch: ${qidToOriginal.size}, remaining: ${stillMissing.length}`);

  // Step 2: Polite fallback wbsearchentities for remaining names
  if (stillMissing.length > 0) {
    const fb = await resolveViaWbSearch(stillMissing);
    for (const [qid, orig] of fb.qidToOriginal.entries()) {
      if (!qidToOriginal.has(qid)) qidToOriginal.set(qid, orig);
    }
    console.log(`Resolved via Wikidata search fallback: ${fb.qidToOriginal.size}`);
  }

  // Step 3: Batch SPARQL verify wdt:P106 wd:Q937857 & fetch structured metadata
  const allQids = Array.from(qidToOriginal.keys());
  const addedRows = [];
  const verifiedOriginals = new Set();

  for (let i = 0; i < allQids.length; i += 50) {
    const chunk = allQids.slice(i, i + 50);
    const values = chunk.map((q) => `wd:${q}`).join(' ');
    const query = `
SELECT ?player ?playerLabel (SAMPLE(?countryLabel) AS ?countryName) (SAMPLE(?posLabel) AS ?posName) (SAMPLE(?clubLabel) AS ?clubName) (SAMPLE(YEAR(?dob)) AS ?birthYear) WHERE {
  VALUES ?player { ${values} }
  ?player wdt:P106 wd:Q937857 .
  OPTIONAL { ?player wdt:P27 ?country . }
  OPTIONAL { ?player wdt:P413 ?pos . }
  OPTIONAL { ?player wdt:P569 ?dob . }
  OPTIONAL { ?player wdt:P54 ?club . }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "tr,en" .
    ?player rdfs:label ?playerLabel .
    ?country rdfs:label ?countryLabel .
    ?pos rdfs:label ?posLabel .
    ?club rdfs:label ?clubLabel .
  }
}
GROUP BY ?player ?playerLabel
`;
    const rows = await runSparql(query);
    for (const r of rows) {
      const qid = r.player?.value?.split('/').pop();
      const origName = qidToOriginal.get(qid);
      if (!origName) continue;
      const norm = normalizeText(origName);
      if (existingNorm.has(norm)) continue;
      existingNorm.add(norm);
      verifiedOriginals.add(origName);

      const birthYear = r.birthYear?.value ? parseInt(r.birthYear.value, 10) : null;
      let id = slugify(origName);
      if (usedIds.has(id)) id = `${id}-${birthYear || usedIds.size}`;
      usedIds.add(id);

      addedRows.push([
        id,
        origName,
        extractSurname(origName),
        COUNTRY_TR_MAP[r.countryName?.value] ?? r.countryName?.value ?? 'Bilinmiyor',
        mapPositionToTurkish(r.posName?.value),
        r.clubName?.value && !/^Q\d+$/.test(r.clubName.value) ? [r.clubName.value] : [],
        birthYear && birthYear >= 1880 && birthYear <= 2012 ? birthYear : null,
      ]);
    }
    await sleep(200);
  }

  // Merge and sort
  const combined = [...guessPoolFile.rows, ...addedRows].sort((a, b) =>
    a[1].localeCompare(b[1], 'tr')
  );

  guessPoolFile.rows = combined;
  guessPoolFile.meta.count = combined.length;
  guessPoolFile.meta.fetchedAt = new Date().toISOString().slice(0, 10);

  fs.writeFileSync(
    path.join(DATA_DIR, 'guessPool.json'),
    JSON.stringify(guessPoolFile) + '\n',
    'utf8'
  );

  const notVerified = missingNames.filter((n) => !verifiedOriginals.has(n));
  console.log(`\nAdded ${addedRows.length} Wikidata-verified TenaBall players to guessPool.json.`);
  console.log(`New guessPool count : ${combined.length}`);
  console.log(`puzzlePool count    : ${puzzlePoolFile.players.length}`);
  console.log(`Still unverified/missing (${notVerified.length}):`);
  for (const n of notVerified) console.log(`  - ${n}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
