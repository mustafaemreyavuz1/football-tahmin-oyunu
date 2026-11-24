#!/usr/bin/env node
/**
 * Checks whether every answer name in active (non-hidden) src/data/tenaball.json lists
 * exists in src/data/guessPool.json.
 * Exits with code 0 when 0 missing names remain in active lists, or code 1 otherwise.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../src/data');

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

const tenaball = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'tenaball.json'), 'utf8'));
const guessPool = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'guessPool.json'), 'utf8'));

const guessNameSet = new Set(guessPool.rows.map((row) => normalizeText(row[1])));

const activeLists = tenaball.filter((q) => !q.hidden);
const hiddenLists = tenaball.filter((q) => q.hidden === true);

const uniqueActiveAnswers = new Map();
for (const q of activeLists) {
  for (const ans of q.answers) {
    const key = normalizeText(ans);
    if (!uniqueActiveAnswers.has(key)) uniqueActiveAnswers.set(key, ans);
  }
}

const missing = [];
for (const [key, original] of uniqueActiveAnswers.entries()) {
  if (!guessNameSet.has(key)) missing.push(original);
}

console.log('=== TenaBall -> guessPool Coverage Report ===');
console.log(`Total TenaBall lists      : ${tenaball.length}`);
console.log(`Active lists (!hidden)    : ${activeLists.length}`);
console.log(`Hidden lists (hidden:true): ${hiddenLists.length}`);
console.log(`Unique active answers     : ${uniqueActiveAnswers.size}`);
console.log(`Found in guessPool        : ${uniqueActiveAnswers.size - missing.length}`);
console.log(`Missing from active lists : ${missing.length}`);

if (missing.length > 0) {
  console.log('\nMissing names in active lists:');
  for (const name of missing.sort()) console.log(`  - ${name}`);
  process.exitCode = 1;
} else {
  console.log('\n100% of active TenaBall answers are covered in guessPool! (exit code 0)');
  process.exitCode = 0;
}
