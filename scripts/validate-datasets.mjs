#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../src/data');

const teams = JSON.parse(fs.readFileSync(path.join(dataDir, 'teams.json'), 'utf8'));
const players = JSON.parse(fs.readFileSync(path.join(dataDir, 'players.json'), 'utf8'));
const tenaball = JSON.parse(fs.readFileSync(path.join(dataDir, 'tenaball.json'), 'utf8'));

const errors = [];

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

// 2. Validate players
if (players.length < 200) {
  errors.push(`Expected at least 200 players, got ${players.length}`);
}
const playerIds = new Set();
for (const p of players) {
  if (!p.id || playerIds.has(p.id)) errors.push(`Player duplicate/missing id: ${p.id}`);
  playerIds.add(p.id);
  for (const field of ['name', 'surname', 'nationality', 'position', 'imageFile', 'imageLicense', 'imageAttribution']) {
    if (typeof p[field] !== 'string' || !p[field].trim()) {
      errors.push(`Player ${p.id} missing ${field}`);
    }
  }
  if (!Array.isArray(p.clubs) || p.clubs.length === 0) {
    errors.push(`Player ${p.id} missing clubs`);
  }
  if (typeof p.birthYear !== 'number' || p.birthYear < 1920 || p.birthYear > 2012) {
    errors.push(`Player ${p.id} invalid birthYear: ${p.birthYear}`);
  }
}

// 3. Validate TenaBall
if (tenaball.length < 200) {
  errors.push(`Expected at least 200 TenaBall questions, got ${tenaball.length}`);
}

console.log('=== Dataset Validation Summary ===');
console.log(`Teams    : ${teams.length} clubs across ${Object.keys(leagueCounts).length} leagues`);
for (const lg of requiredLeagues) {
  console.log(`  - ${lg}: ${leagueCounts[lg]} clubs`);
}
console.log(`Players  : ${players.length} players`);
console.log(`TenaBall : ${tenaball.length} questions`);

if (errors.length > 0) {
  console.error('\nValidation errors:');
  for (const err of errors) console.error(`  ! ${err}`);
  process.exit(1);
}

console.log('\nAll datasets are valid!');
