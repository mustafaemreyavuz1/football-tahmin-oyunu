#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../src/data');

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

const teams = JSON.parse(fs.readFileSync(path.join(dataDir, 'teams.json'), 'utf8'));
const puzzlePoolData = JSON.parse(fs.readFileSync(path.join(dataDir, 'puzzlePool.json'), 'utf8'));
const guessPoolData = JSON.parse(fs.readFileSync(path.join(dataDir, 'guessPool.json'), 'utf8'));
const tenaball = JSON.parse(fs.readFileSync(path.join(dataDir, 'tenaball.json'), 'utf8'));

const puzzlePool = puzzlePoolData.players;
const guessPool = guessPoolData.rows;

const errors = [];
const warnings = [];

// 1. Validate teams
const requiredLeagues = ['Süper Lig', 'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'];
const leagueCounts = {};
const teamIds = new Set();
const hexRe = /^#[0-9A-Fa-f]{6}$/;

for (const t of teams) {
  if (!t.id || teamIds.has(t.id)) errors.push(`Team duplicate/missing id: ${t.id}`);
  teamIds.add(t.id);
  if (!hexRe.test(t.primaryColor) || !hexRe.test(t.secondaryColor)) {
    errors.push(`Team invalid hex color: ${t.id}`);
  }
  if ('logo' in t || 'crest' in t) {
    errors.push(`Team must not include logo/crest: ${t.id}`);
  }
  leagueCounts[t.league] = (leagueCounts[t.league] ?? 0) + 1;
}
for (const lg of requiredLeagues) {
  if (!leagueCounts[lg] || leagueCounts[lg] < 18) {
    errors.push(`League ${lg} has unexpected club count: ${leagueCounts[lg] ?? 0}`);
  }
}

// 2. Validate puzzlePool (200-300 verified players with images, license, attribution)
if (puzzlePool.length < 200 || puzzlePool.length > 300) {
  errors.push(`Expected puzzlePool size between 200 and 300, got ${puzzlePool.length}`);
}
const puzzleIds = new Set();
const puzzleNormNames = new Set();
let puzzleDuplicates = 0;

for (const p of puzzlePool) {
  if (!p.id || puzzleIds.has(p.id)) errors.push(`puzzlePool duplicate/missing id: ${p.id}`);
  puzzleIds.add(p.id);

  const norm = normalizeText(p.name);
  if (puzzleNormNames.has(norm)) {
    puzzleDuplicates += 1;
    errors.push(`puzzlePool duplicate normalized name: ${p.name}`);
  }
  puzzleNormNames.add(norm);

  for (const field of ['name', 'surname', 'nationality', 'position', 'imageFile', 'imageLicense', 'imageAttribution']) {
    if (typeof p[field] !== 'string' || !p[field].trim()) {
      errors.push(`puzzlePool ${p.id} missing ${field}`);
    }
  }
  if (!Array.isArray(p.clubs) || p.clubs.length === 0) {
    errors.push(`puzzlePool ${p.id} missing clubs`);
  }
  if (typeof p.birthYear !== 'number' || p.birthYear < 1920 || p.birthYear > 2012) {
    errors.push(`puzzlePool ${p.id} invalid birthYear: ${p.birthYear}`);
  }
}

// 3. Validate guessPool (2000+ players, lightweight tuple format, deduped, superset of puzzlePool)
if (guessPool.length < 2000) {
  errors.push(`Expected guessPool size >= 2000, got ${guessPool.length}`);
}
const guessIds = new Set();
const guessNormNames = new Set();
let guessDuplicates = 0;

for (const row of guessPool) {
  if (!Array.isArray(row) || (row.length !== 7 && row.length !== 8)) {
    errors.push(`guessPool malformed tuple: ${JSON.stringify(row)}`);
    continue;
  }
  const [id, name, surname, nationality, position, clubs] = row;
  if (!id || guessIds.has(id)) {
    errors.push(`guessPool duplicate/missing id: ${id}`);
  }
  guessIds.add(id);

  const norm = normalizeText(name);
  if (guessNormNames.has(norm)) {
    guessDuplicates += 1;
    errors.push(`guessPool duplicate normalized name: ${name}`);
  }
  guessNormNames.add(norm);

  if (!name?.trim() || !surname?.trim() || !nationality?.trim() || !position?.trim()) {
    errors.push(`guessPool ${id} missing required string fields`);
  }
  if (!Array.isArray(clubs)) {
    errors.push(`guessPool ${id} clubs must be an array`);
  }
}

// Verify every puzzlePool player is also in guessPool
let missingPuzzleInGuess = 0;
for (const p of puzzlePool) {
  if (!guessNormNames.has(normalizeText(p.name))) {
    missingPuzzleInGuess += 1;
    errors.push(`puzzlePool player missing from guessPool: ${p.name}`);
  }
}

// 4. Validate TenaBall & check active TenaBall answer coverage in guessPool
if (tenaball.length < 200) {
  errors.push(`Expected at least 200 TenaBall questions, got ${tenaball.length}`);
}

const activeTenaBall = tenaball.filter((q) => !q.hidden);
const hiddenTenaBall = tenaball.filter((q) => q.hidden === true);
const verifiedPlayableTenaBall = activeTenaBall.filter((q) => q.verified === true);

const uniqueTenaBallAnswers = new Map();
for (const q of activeTenaBall) {
  for (const ans of q.answers) {
    const k = normalizeText(ans);
    if (!uniqueTenaBallAnswers.has(k)) {
      uniqueTenaBallAnswers.set(k, ans);
    }
  }
}

const missingTenaBallAnswers = [];
for (const [k, raw] of uniqueTenaBallAnswers.entries()) {
  if (!guessNormNames.has(k)) {
    missingTenaBallAnswers.push(raw);
  }
}
if (missingTenaBallAnswers.length > 0) {
  errors.push(`${missingTenaBallAnswers.length} active TenaBall answer(s) missing from guessPool`);
}

console.log('=== Dataset Validation Summary ===');
console.log(`Teams                  : ${teams.length} clubs across ${Object.keys(leagueCounts).length} leagues`);
for (const lg of requiredLeagues) {
  console.log(`  - ${lg}: ${leagueCounts[lg]} clubs`);
}
console.log(`puzzlePool             : ${puzzlePool.length} verified players (duplicates: ${puzzleDuplicates})`);
console.log(`guessPool              : ${guessPool.length} players (duplicates: ${guessDuplicates})`);
console.log(`puzzlePool in guessPool: ${puzzlePool.length - missingPuzzleInGuess}/${puzzlePool.length}`);
console.log(`TenaBall lists         : ${tenaball.length} total (${activeTenaBall.length} active, ${hiddenTenaBall.length} hidden, ${verifiedPlayableTenaBall.length} verified playable)`);
console.log(`Active unique answers  : ${uniqueTenaBallAnswers.size}`);
console.log(`Missing active answers : ${missingTenaBallAnswers.length}`);

if (missingTenaBallAnswers.length > 0) {
  console.log('  Missing list:');
  for (const m of missingTenaBallAnswers) console.log(`    - ${m}`);
}

if (warnings.length > 0) {
  console.warn('\nWarnings:');
  for (const w of warnings) console.warn(`  * ${w}`);
}

if (errors.length > 0) {
  console.error('\nValidation errors:');
  for (const err of errors) console.error(`  ! ${err}`);
  process.exit(1);
}

console.log('\nAll datasets are valid!');
