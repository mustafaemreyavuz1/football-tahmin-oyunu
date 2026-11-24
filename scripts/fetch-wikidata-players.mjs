#!/usr/bin/env node
/**
 * Fetches real footballers from Wikidata (CC0 1.0 Public Domain) to build:
 *   - src/data/puzzlePool.json (200-300 footballers with verified Wikimedia Commons image, license & attribution)
 *   - src/data/guessPool.json (2000+ footballers, lightweight tuple format, deduped, superset of puzzlePool)
 *   - verifies & adds missing TenaBall answer players from Wikidata (never invents players)
 *
 * Usage:
 *   node scripts/fetch-wikidata-players.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../src/data');
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const WB_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
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

function normalizeForWordle(surname) {
  return normalizeText(surname).replace(/[^a-z]/g, '').toUpperCase();
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
  if (
    p.includes('defender') ||
    p.includes('back') ||
    p.includes('sweeper') ||
    p.includes('defans') ||
    p.includes('stoper')
  ) {
    return 'Defans';
  }
  if (
    p.includes('forward') ||
    p.includes('striker') ||
    p.includes('winger') ||
    p.includes('forvet') ||
    p.includes('hücum')
  ) {
    return 'Forvet';
  }
  return 'Orta Saha';
}

const COUNTRY_TR_MAP = {
  Turkey: 'Türkiye',
  England: 'İngiltere',
  'United Kingdom': 'İngiltere',
  Spain: 'İspanya',
  France: 'Fransa',
  Germany: 'Almanya',
  Italy: 'İtalya',
  Brazil: 'Brezilya',
  Argentina: 'Arjantin',
  Portugal: 'Portekiz',
  Netherlands: 'Hollanda',
  'Kingdom of the Netherlands': 'Hollanda',
  Belgium: 'Belçika',
  Croatia: 'Hırvatistan',
  Uruguay: 'Uruguay',
  Poland: 'Polonya',
  Sweden: 'İsveç',
  Norway: 'Norveç',
  Denmark: 'Danimarka',
  Switzerland: 'İsviçre',
  Austria: 'Avusturya',
  Serbia: 'Sırbistan',
  Ukraine: 'Ukrayna',
  Colombia: 'Kolombiya',
  Chile: 'Şili',
  Mexico: 'Meksika',
  'United States': 'ABD',
  Canada: 'Kanada',
  Japan: 'Japonya',
  'South Korea': 'Güney Kore',
  Egypt: 'Mısır',
  Morocco: 'Fas',
  Nigeria: 'Nijerya',
  Senegal: 'Senegal',
  'Ivory Coast': 'Fildişi Sahili',
  "Côte d'Ivoire": 'Fildişi Sahili',
  Cameroon: 'Kamerun',
  Ghana: 'Gana',
  Algeria: 'Cezayir',
  Greece: 'Yunanistan',
  Romania: 'Romanya',
  Scotland: 'İskoçya',
  Wales: 'Galler',
  Ireland: 'İrlanda',
  'Republic of Ireland': 'İrlanda',
  'Czech Republic': 'Çekya',
  Czechia: 'Çekya',
  Hungary: 'Macaristan',
  Slovakia: 'Slovakya',
  Slovenia: 'Slovenya',
  'Bosnia and Herzegovina': 'Bosna-Hersek',
  Georgia: 'Gürcistan',
  Russia: 'Rusya',
  Ecuador: 'Ekvador',
  Paraguay: 'Paraguay',
  Peru: 'Peru',
  Venezuela: 'Venezuela',
  'Costa Rica': 'Kosta Rika',
  Australia: 'Avustralya',
  Bulgaria: 'Bulgaristan',
  Finland: 'Finlandiya',
  Iceland: 'İzlanda',
  Albania: 'Arnavutluk',
  'North Macedonia': 'Kuzey Makedonya',
  Montenegro: 'Karadağ',
  Kosovo: 'Kosova',
  Israel: 'İsrail',
  Iran: 'İran',
  'Saudi Arabia': 'Suudi Arabistan',
  Mali: 'Mali',
  Guinea: 'Gine',
  Tunisia: 'Tunus',
  'South Africa': 'Güney Afrika',
  'DR Congo': 'Kongo DC',
  'Democratic Republic of the Congo': 'Kongo DC',
  Gabon: 'Gabon',
  'Burkina Faso': 'Burkina Faso',
  Jamaica: 'Jamaika',
  Honduras: 'Honduras',
  Panama: 'Panama',
};

function mapCountryToTurkish(raw) {
  if (!raw) return 'Bilinmiyor';
  return COUNTRY_TR_MAP[raw] ?? raw;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runSparql(query, attempt = 1) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) {
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(attempt * 2000);
      return runSparql(query, attempt + 1);
    }
    throw new Error(`SPARQL HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.results.bindings;
}

/**
 * Fast league-scoped SPARQL query (avoids slow transitive paths & global sorts).
 * Also returns optional P18 image URL so we can top up verified puzzlePool entries cleanly.
 */
async function fetchLeaguePlayers(label, leagueQid, limit = 650) {
  const query = `
SELECT ?player ?playerLabel (SAMPLE(?countryLabel) AS ?countryName) (SAMPLE(?posLabel) AS ?posName) (SAMPLE(?clubLabel) AS ?clubName) (SAMPLE(YEAR(?dob)) AS ?birthYear) (SAMPLE(?img) AS ?image) WHERE {
  {
    SELECT DISTINCT ?player ?club WHERE {
      ?club wdt:P118 wd:${leagueQid} .
      ?player wdt:P54 ?club ;
              wdt:P106 wd:Q937857 ;
              wikibase:sitelinks ?sl .
      FILTER(?sl >= 18)
    }
    LIMIT ${limit}
  }
  OPTIONAL { ?player wdt:P27 ?country . }
  OPTIONAL { ?player wdt:P413 ?pos . }
  OPTIONAL { ?player wdt:P569 ?dob . }
  OPTIONAL { ?player wdt:P18 ?img . }
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
  console.log(`Fetching Wikidata players for ${label} (limit ${limit})...`);
  const rows = await runSparql(query);
  console.log(`  -> ${rows.length} rows`);
  return rows;
}

/**
 * Batch-verifies Wikimedia Commons filenames & returns authentic license + artist attribution.
 */
async function verifyCommonsBatch(fileNames) {
  const result = new Map();
  for (let i = 0; i < fileNames.length; i += 40) {
    const batch = fileNames.slice(i, i + 40);
    const titles = batch.map((f) => `File:${f}`).join('|');
    const url = `${COMMONS_API}?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=extmetadata&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) continue;
    const data = await res.json();
    const normMap = new Map();
    for (const n of data.query?.normalized || []) normMap.set(n.from, n.to);
    const pageByTitle = new Map();
    for (const pg of Object.values(data.query?.pages || {})) pageByTitle.set(pg.title, pg);

    for (const f of batch) {
      const rawTitle = `File:${f}`;
      const normTitle = normMap.get(rawTitle) || rawTitle;
      const pg = pageByTitle.get(normTitle);
      const info = pg?.imageinfo?.[0];
      if (!pg || 'missing' in pg || !info?.extmetadata) continue;
      const meta = info.extmetadata;
      const license = meta.LicenseShortName?.value || '';
      if (!/cc|public domain|pd|gfdl|free/i.test(license)) continue;
      const artistRaw = meta.Artist?.value || 'Wikimedia Commons';
      const artist = artistRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
      result.set(f, {
        imageFile: pg.title.replace(/^File:/, '').replace(/ /g, '_'),
        imageLicense: license,
        imageAttribution: `Wikimedia Commons — ${artist}`,
      });
    }
    await sleep(120);
  }
  return result;
}

/**
 * Batch-resolves Wikidata P18 images for curated puzzlePool players whose filename wasn't directly found.
 */
async function resolveCuratedPuzzlePool(curatedPlayers) {
  console.log(`\nVerifying Wikimedia Commons images for ${curatedPlayers.length} curated players...`);
  const direct = await verifyCommonsBatch(curatedPlayers.map((p) => p.imageFile));

  const verified = [];
  const unresolved = [];
  for (const p of curatedPlayers) {
    const hit = direct.get(p.imageFile);
    if (hit) {
      verified.push({ ...p, ...hit });
    } else {
      unresolved.push(p);
    }
  }
  console.log(`  -> Directly verified: ${verified.length}, looking up P18 for ${unresolved.length}...`);

  // Look up QIDs via wbsearchentities with concurrency 5
  const qidToPlayer = new Map();
  for (let i = 0; i < unresolved.length; i += 5) {
    const chunk = unresolved.slice(i, i + 5);
    await Promise.all(
      chunk.map(async (p) => {
        try {
          const url = `${WB_API}?action=wbsearchentities&search=${encodeURIComponent(p.name)}&language=en&format=json&limit=4&type=item`;
          const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
          if (!res.ok) return;
          const data = await res.json();
          const hit =
            (data.search || []).find((c) => /football|soccer|goalkeeper/i.test(c.description || '')) ||
            data.search?.[0];
          if (hit?.id) qidToPlayer.set(hit.id, p);
        } catch {}
      })
    );
    await sleep(100);
  }

  // Batch fetch P18 via SPARQL VALUES
  const qids = Array.from(qidToPlayer.keys());
  const candidates = [];
  for (let i = 0; i < qids.length; i += 50) {
    const chunk = qids.slice(i, i + 50);
    const values = chunk.map((q) => `wd:${q}`).join(' ');
    const query = `SELECT ?p ?img WHERE { VALUES ?p { ${values} } ?p wdt:P18 ?img . }`;
    try {
      const rows = await runSparql(query);
      const seenQ = new Set();
      for (const r of rows) {
        const qid = r.p?.value?.split('/').pop();
        if (!qid || seenQ.has(qid)) continue;
        seenQ.add(qid);
        const rawUrl = r.img?.value || '';
        const fileName = decodeURIComponent(rawUrl.split('/').pop() || '');
        if (fileName) {
          candidates.push({ player: qidToPlayer.get(qid), fileName });
        }
      }
    } catch {}
  }

  const p18Verified = await verifyCommonsBatch(candidates.map((c) => c.fileName));
  for (const { player, fileName } of candidates) {
    const meta = p18Verified.get(fileName);
    if (meta) {
      verified.push({ ...player, ...meta });
    }
  }

  console.log(`  -> Verified from curated list: ${verified.length}`);
  return verified;
}

/**
 * Looks up missing TenaBall answer players on Wikidata (never invents).
 */
async function lookupMissingTenaBallPlayers(missingNames) {
  if (missingNames.length === 0) return { found: [], notFound: [] };
  console.log(`\nLooking up ${missingNames.length} missing TenaBall names on Wikidata...`);

  const qidsByName = new Map();
  const notFound = [];

  for (let i = 0; i < missingNames.length; i += 5) {
    const chunk = missingNames.slice(i, i + 5);
    await Promise.all(
      chunk.map(async (name) => {
        try {
          const url = `${WB_API}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&limit=5&type=item`;
          const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
          if (!res.ok) {
            notFound.push(name);
            return;
          }
          const data = await res.json();
          const best = (data.search || []).find((c) =>
            /football|soccer|goalkeeper|striker|midfielder|defender|futbol/i.test(c.description || '')
          );
          if (best?.id) {
            qidsByName.set(best.id, { originalName: name, qid: best.id });
          } else {
            notFound.push(name);
          }
        } catch {
          notFound.push(name);
        }
      })
    );
    await sleep(100);
  }

  const qids = Array.from(qidsByName.keys());
  const found = [];

  for (let i = 0; i < qids.length; i += 45) {
    const chunk = qids.slice(i, i + 45);
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
    const matchedQids = new Set();
    for (const r of rows) {
      const qid = r.player?.value?.split('/').pop();
      if (!qid || matchedQids.has(qid)) continue;
      matchedQids.add(qid);
      const info = qidsByName.get(qid);
      const name = info?.originalName || r.playerLabel?.value;
      const birthYear = r.birthYear?.value ? parseInt(r.birthYear.value, 10) : undefined;
      found.push({
        name,
        surname: extractSurname(name),
        nationality: mapCountryToTurkish(r.countryName?.value),
        position: mapPositionToTurkish(r.posName?.value),
        clubs: r.clubName?.value && !/^Q\d+$/.test(r.clubName.value) ? [r.clubName.value] : [],
        birthYear: birthYear && birthYear >= 1900 && birthYear <= 2012 ? birthYear : undefined,
      });
    }
    for (const q of chunk) {
      if (!matchedQids.has(q)) {
        const info = qidsByName.get(q);
        if (info) notFound.push(info.originalName);
      }
    }
    await sleep(200);
  }

  return { found, notFound };
}

function addToPoolMap(map, entry, priority = 0) {
  if (!entry.name || /^Q\d+$/.test(entry.name)) return;
  const normKey = normalizeText(entry.name);
  if (!normKey || normKey.length < 3) return;

  const existing = map.get(normKey);
  if (!existing) {
    map.set(normKey, { ...entry, _priority: priority });
    return;
  }

  const keepNew = priority > existing._priority;
  const mergedClubs = Array.from(
    new Set([...(existing.clubs || []), ...(entry.clubs || [])].filter(Boolean))
  ).slice(0, 6);

  map.set(normKey, {
    id: keepNew ? entry.id || existing.id : existing.id,
    name: keepNew ? entry.name : existing.name,
    surname: keepNew ? entry.surname : existing.surname,
    nationality:
      existing.nationality && existing.nationality !== 'Bilinmiyor'
        ? existing.nationality
        : entry.nationality || 'Bilinmiyor',
    position:
      existing.position && existing.position !== 'Orta Saha'
        ? existing.position
        : entry.position || 'Orta Saha',
    clubs: mergedClubs,
    birthYear: existing.birthYear ?? entry.birthYear,
    _priority: Math.max(existing._priority, priority),
  });
}

async function main() {
  const existingPlayersPath = path.join(DATA_DIR, 'players.json');
  const tenaballPath = path.join(DATA_DIR, 'tenaball.json');

  const curatedPlayers = JSON.parse(fs.readFileSync(existingPlayersPath, 'utf8'));
  const tenaballQuestions = JSON.parse(fs.readFileSync(tenaballPath, 'utf8'));

  // 1. Verify curated puzzlePool images via Commons & Wikidata P18
  const verifiedCurated = await resolveCuratedPuzzlePool(curatedPlayers);

  // Deduplicate curated verified puzzlePool
  const puzzleMap = new Map();
  for (const p of verifiedCurated) {
    const key = normalizeText(p.name);
    if (!puzzleMap.has(key)) puzzleMap.set(key, p);
  }

  // 2. Fetch 2000+ real footballers from Wikidata across major European & Turkish leagues
  const leagueQueries = [
    ['Süper Lig', 'Q485568', 550],
    ['Premier League', 'Q9448', 650],
    ['La Liga', 'Q324867', 650],
    ['Serie A', 'Q15804', 650],
    ['Bundesliga', 'Q82595', 600],
    ['Ligue 1', 'Q13394', 600],
    ['Eredivisie', 'Q167541', 400],
    ['Primeira Liga', 'Q182994', 400],
  ];

  const poolMap = new Map();
  const extraPuzzleCandidates = [];

  for (const [label, qid, limit] of leagueQueries) {
    try {
      const rows = await fetchLeaguePlayers(label, qid, limit);
      for (const r of rows) {
        const name = r.playerLabel?.value?.trim();
        if (!name || /^Q\d+$/.test(name)) continue;
        const birthYear = r.birthYear?.value ? parseInt(r.birthYear.value, 10) : undefined;
        const surname = extractSurname(name);
        const clubs = r.clubName?.value && !/^Q\d+$/.test(r.clubName.value) ? [r.clubName.value] : [];
        const nationality = mapCountryToTurkish(r.countryName?.value);
        const position = mapPositionToTurkish(r.posName?.value);

        const entry = {
          id: slugify(name),
          name,
          surname,
          nationality,
          position,
          clubs,
          birthYear: birthYear && birthYear >= 1900 && birthYear <= 2012 ? birthYear : undefined,
        };
        addToPoolMap(poolMap, entry, 1);

        // Collect candidates with P18 image + birthYear + valid Wordle surname to top up puzzlePool to ~240
        const rawImg = r.image?.value || '';
        const fileName = decodeURIComponent(rawImg.split('/').pop() || '');
        const normWordle = normalizeForWordle(surname);
        if (
          fileName &&
          birthYear &&
          birthYear >= 1940 &&
          birthYear <= 2008 &&
          clubs.length > 0 &&
          normWordle.length >= 4 &&
          normWordle.length <= 12 &&
          !puzzleMap.has(normalizeText(name))
        ) {
          extraPuzzleCandidates.push({ entry, fileName });
        }
      }
      await sleep(300);
    } catch (err) {
      console.error(`Warning: ${label} query failed: ${err.message}`);
    }
  }

  // 3. Top up puzzlePool to 240 verified players (strictly within 200-300)
  const TARGET_PUZZLE_POOL = 240;
  if (puzzleMap.size < TARGET_PUZZLE_POOL && extraPuzzleCandidates.length > 0) {
    const needed = TARGET_PUZZLE_POOL - puzzleMap.size;
    console.log(`\nTopping up puzzlePool from ${puzzleMap.size} to ${TARGET_PUZZLE_POOL} using Wikidata P18...`);
    const sample = extraPuzzleCandidates.slice(0, needed * 2);
    const metaMap = await verifyCommonsBatch(sample.map((s) => s.fileName));
    for (const { entry, fileName } of sample) {
      if (puzzleMap.size >= TARGET_PUZZLE_POOL) break;
      const meta = metaMap.get(fileName);
      const key = normalizeText(entry.name);
      if (meta && !puzzleMap.has(key)) {
        puzzleMap.set(key, {
          ...entry,
          birthYear: entry.birthYear,
          ...meta,
        });
      }
    }
  }

  const finalPuzzlePool = Array.from(puzzleMap.values());

  // Ensure every puzzlePool player is inside guessPool with highest priority (3)
  for (const p of finalPuzzlePool) {
    addToPoolMap(
      poolMap,
      {
        id: p.id,
        name: p.name,
        surname: p.surname,
        nationality: p.nationality,
        position: p.position,
        clubs: p.clubs,
        birthYear: p.birthYear,
      },
      3
    );
  }

  console.log(`\nPool size after league queries + puzzlePool merge: ${poolMap.size}`);

  // 4. Verify & add missing TenaBall answer players from Wikidata (never invent)
  const uniqueTenaBallNames = new Map();
  for (const q of tenaballQuestions) {
    for (const ans of q.answers) {
      const k = normalizeText(ans);
      if (!uniqueTenaBallNames.has(k)) uniqueTenaBallNames.set(k, ans);
    }
  }

  const missingBeforeLookup = [];
  for (const [normKey, rawName] of uniqueTenaBallNames.entries()) {
    if (!poolMap.has(normKey)) missingBeforeLookup.push(rawName);
  }

  const { found: foundMissing, notFound } = await lookupMissingTenaBallPlayers(missingBeforeLookup);
  for (const p of foundMissing) {
    addToPoolMap(
      poolMap,
      {
        id: slugify(p.name),
        name: p.name,
        surname: p.surname,
        nationality: p.nationality,
        position: p.position,
        clubs: p.clubs,
        birthYear: p.birthYear,
      },
      2
    );
  }

  console.log(`Added ${foundMissing.length} verified TenaBall players from Wikidata.`);
  if (notFound.length > 0) {
    console.log(`Not found on Wikidata (${notFound.length}, NOT invented):`);
    for (const n of notFound) console.log(`  - ${n}`);
  }

  // 5. Finalize unique IDs & lightweight tuple format for guessPool
  const usedIds = new Set();
  // Reserve puzzlePool IDs first so IDs match identically between puzzlePool and guessPool
  for (const p of finalPuzzlePool) usedIds.add(p.id);

  const guessPoolCompact = [];
  const sortedEntries = Array.from(poolMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'tr')
  );

  for (const item of sortedEntries) {
    let id = item.id || slugify(item.name);
    if (!puzzleMap.has(normalizeText(item.name)) && usedIds.has(id)) {
      id = `${id}-${item.birthYear || usedIds.size}`;
    }
    usedIds.add(id);
    guessPoolCompact.push([
      id,
      item.name,
      item.surname,
      item.nationality || 'Bilinmiyor',
      item.position || 'Orta Saha',
      item.clubs || [],
      item.birthYear ?? null,
    ]);
  }

  const fetchedAt = new Date().toISOString().slice(0, 10);

  const puzzlePoolOut = {
    meta: {
      source: 'Wikidata + Wikimedia Commons',
      license: 'CC0 1.0 (metadata) / CC BY, CC BY-SA & Public Domain (images)',
      fetchedAt,
      count: finalPuzzlePool.length,
    },
    players: finalPuzzlePool,
  };

  const guessPoolOut = {
    meta: {
      source: 'Wikidata SPARQL (https://query.wikidata.org/sparql)',
      license: 'CC0 1.0 Universal (Public Domain Dedication)',
      fetchedAt,
      format: '[id, name, surname, nationality, position, clubs, birthYear]',
      count: guessPoolCompact.length,
    },
    rows: guessPoolCompact,
  };

  fs.writeFileSync(
    path.join(DATA_DIR, 'puzzlePool.json'),
    JSON.stringify(puzzlePoolOut, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'guessPool.json'),
    JSON.stringify(guessPoolOut) + '\n',
    'utf8'
  );

  const guessBytes = fs.statSync(path.join(DATA_DIR, 'guessPool.json')).size;
  console.log('\n=== Done ===');
  console.log(`puzzlePool.json : ${finalPuzzlePool.length} verified players`);
  console.log(`guessPool.json  : ${guessPoolCompact.length} players (${(guessBytes / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
