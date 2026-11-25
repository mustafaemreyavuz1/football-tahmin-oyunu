#!/usr/bin/env node
/**
 * Precomputes normalized ASCII search keys into src/data/guessPool.json (8th tuple element)
 * so runtime indexing performs ZERO String.prototype.normalize('NFD') calls on Hermes/Android.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUESS_PATH = path.resolve(__dirname, '../src/data/guessPool.json');

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

const data = JSON.parse(fs.readFileSync(GUESS_PATH, 'utf8'));
data.rows = data.rows.map((row) => {
  const base = row.slice(0, 7);
  const normName = normalizeText(base[1]);
  return [...base, normName];
});
data.meta.format = '[id, name, surname, nationality, position, clubs, birthYear, normName]';
data.meta.count = data.rows.length;

fs.writeFileSync(GUESS_PATH, JSON.stringify(data) + '\n', 'utf8');
const kb = (fs.statSync(GUESS_PATH).size / 1024).toFixed(1);
console.log(`Precomputed search keys for ${data.rows.length} players (${kb} KB)`);
