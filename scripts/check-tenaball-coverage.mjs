#!/usr/bin/env node
/**
 * Checks whether every answer name in src/data/tenaball.json exists in src/data/guessPool.json.
 * Reports exact coverage count and lists any missing names.
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

const guessNameSet = new Set();
for (const row of guessPool.rows) {
  guessNameSet.add(normalizeText(row[1])); // full name
}

const uniqueAnswers = new Map();
for (const q of tenaball) {
  for (const ans of q.answers) {
    const key = normalizeText(ans);
    if (!uniqueAnswers.has(key)) {
      uniqueAnswers.set(key, ans);
    }
  }
}

const missing = [];
for (const [key, original] of uniqueAnswers.entries()) {
  if (!guessNameSet.has(key)) {
    missing.push(original);
  }
}

console.log('=== TenaBall -> guessPool Coverage Report ===');
console.log(`Total TenaBall questions : ${tenaball.length}`);
console.log(`Unique answer players    : ${uniqueAnswers.size}`);
console.log(`Found in guessPool       : ${uniqueAnswers.size - missing.length}`);
console.log(`Missing from guessPool   : ${missing.length}`);

if (missing.length > 0) {
  console.log('\nMissing names:');
  for (const name of missing.sort()) {
    console.log(`  - ${name}`);
  }
  process.exitCode = 1;
} else {
  console.log('\n100% of TenaBall answers are covered in guessPool!');
}
