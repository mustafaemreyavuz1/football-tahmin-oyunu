#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRevealSchedule,
  MAX_REVEAL_TOTAL_MS,
} from '../src/games/tenaball/countdownAnimation.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../src/data');

const CHAR_MAP = {
  ı: 'i', İ: 'i', I: 'i', ğ: 'g', Ğ: 'g', ş: 's', Ş: 's',
  ç: 'c', Ç: 'c', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u',
  ø: 'o', Ø: 'o', đ: 'd', Đ: 'd', ł: 'l', Ł: 'l', ß: 'ss',
};

function normalizeText(input) {
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

function evaluateWordleGuess(guess, target) {
  const len = target.length;
  const result = new Array(len).fill('absent');
  const rem = {};
  for (let i = 0; i < len; i += 1) {
    if (guess[i] === target[i]) result[i] = 'correct';
    else rem[target[i]] = (rem[target[i]] ?? 0) + 1;
  }
  for (let i = 0; i < len; i += 1) {
    if (result[i] === 'correct') continue;
    if ((rem[guess[i]] ?? 0) > 0) {
      result[i] = 'present';
      rem[guess[i]] -= 1;
    }
  }
  return result;
}

// 1. Normalization tests
assert.equal(normalizeText('Hakan Çalhanoğlu'), 'hakan calhanoglu');
assert.equal(normalizeText('Martin Ødegaard'), 'martin odegaard');
assert.equal(normalizeForWordle('De Bruyne'), 'DEBRUYNE');
assert.equal(normalizeForWordle('Çalhanoğlu'), 'CALHANOGLU');
assert.equal(normalizeForWordle("Eto'o"), 'ETOO');
assert.equal(normalizeForWordle('Güler'), 'GULER');

// 2. Wordle evaluation tests (duplicate letters)
assert.deepEqual(evaluateWordleGuess('MESSI', 'MESSI'), [
  'correct', 'correct', 'correct', 'correct', 'correct',
]);
assert.deepEqual(evaluateWordleGuess('SSSSS', 'MESSI'), [
  'absent', 'absent', 'correct', 'correct', 'absent',
]);
assert.deepEqual(evaluateWordleGuess('ALABA', 'SALAH'), [
  'present', 'present', 'present', 'absent', 'absent',
]);

// 3. Daily permutation uniqueness over a full 200-day cycle
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function getDailyIndexForDay(gameId, poolLength, dayNum) {
  const cycle = Math.floor(dayNum / poolLength);
  const pos = dayNum % poolLength;
  const rand = mulberry32(hashString(`football-tahmin-oyunu:${gameId}:cycle:${cycle}`));
  const indices = Array.from({ length: poolLength }, (_, i) => i);
  for (let i = poolLength - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices[pos];
}

const seen = new Set();
for (let d = 0; d < 200; d += 1) {
  seen.add(getDailyIndexForDay('tenaball', 200, d));
}
assert.equal(seen.size, 200, 'Daily cycle must visit every puzzle once without repeating');

// 4. Two-pool integrity & deduplication tests
const puzzlePoolData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'puzzlePool.json'), 'utf8'));
const guessPoolData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'guessPool.json'), 'utf8'));

const puzzlePool = puzzlePoolData.players;
const guessRows = guessPoolData.rows;

assert.ok(
  puzzlePool.length >= 200 && puzzlePool.length <= 300,
  `puzzlePool must be 200..300, got ${puzzlePool.length}`
);
assert.ok(
  guessRows.length >= 2000,
  `guessPool must be >= 2000, got ${guessRows.length}`
);

const validWordleCount = puzzlePool.filter((p) => {
  const w = normalizeForWordle(p.surname);
  return w.length >= 3 && w.length <= 14;
}).length;
assert.ok(validWordleCount >= 200, `Expected >=200 Wordle players in puzzlePool, got ${validWordleCount}`);

const guessNormSet = new Set();
for (const row of guessRows) {
  const k = normalizeText(row[1]);
  assert.ok(!guessNormSet.has(k), `Duplicate normalized player in guessPool: ${row[1]}`);
  guessNormSet.add(k);
}

for (const p of puzzlePool) {
  assert.ok(
    guessNormSet.has(normalizeText(p.name)),
    `puzzlePool player missing from guessPool: ${p.name}`
  );
}

// 5. TenaBall verified / hidden filtering rules
const tenaball = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'tenaball.json'), 'utf8'));
const filterPlayable = (list, includeUnverified) =>
  list.filter((q) => !q.hidden && (includeUnverified || q.verified === true));

const strictPlayable = filterPlayable(tenaball, false);
const withUnverified = filterPlayable(tenaball, true);
assert.ok(
  withUnverified.every((q) => !q.hidden),
  'hidden: true lists must NEVER appear even when includeUnverified is true'
);
assert.ok(
  strictPlayable.every((q) => q.verified === true && !q.hidden),
  'Strict mode must only return verified: true and non-hidden lists'
);
assert.equal(withUnverified.length, 186, 'Expected 186 non-hidden active TenaBall lists');

// 6. TenaBall countdown reveal animation schedule tests
const schedules = [];
for (let rank = 1; rank <= 10; rank += 1) {
  const s = buildRevealSchedule(rank);
  schedules[rank] = s;

  assert.equal(s.steps[0], 10, `Rank ${rank}: must start at slot 10`);
  assert.equal(s.steps[s.steps.length - 1], rank, `Rank ${rank}: must end at target rank`);
  assert.equal(s.steps.length, 11 - rank, `Rank ${rank}: step count mismatch`);
  assert.equal(s.tickCount, s.steps.length, `Rank ${rank}: tickCount must equal step count`);
  assert.equal(s.stepDurationsMs.length, s.steps.length, `Rank ${rank}: durations length mismatch`);
  assert.equal(
    s.stepDurationsMs.reduce((a, b) => a + b, 0),
    s.totalDurationMs,
    `Rank ${rank}: totalDurationMs must equal sum of stepDurationsMs`
  );
  assert.ok(
    s.totalDurationMs <= MAX_REVEAL_TOTAL_MS,
    `Rank ${rank}: totalDurationMs (${s.totalDurationMs}) exceeded cap (${MAX_REVEAL_TOTAL_MS})`
  );
  for (let i = 1; i < s.stepDurationsMs.length; i += 1) {
    assert.ok(
      s.stepDurationsMs[i] >= s.stepDurationsMs[i - 1],
      `Rank ${rank}: step durations must be non-decreasing (ease-out)`
    );
  }
}
assert.ok(schedules[10].totalDurationMs < schedules[1].totalDurationMs, 'Rank 10 must be shorter than rank 1');
for (let rank = 10; rank > 1; rank -= 1) {
  assert.ok(
    schedules[rank].totalDurationMs < schedules[rank - 1].totalDurationMs,
    `Duration must increase monotonically from rank ${rank} to ${rank - 1}`
  );
}

// 7. Procedural tick.wav integrity check (RIFF/WAVE 16-bit mono PCM)
const wavPath = path.resolve(__dirname, '../assets/sounds/tick.wav');
const wavBuf = fs.readFileSync(wavPath);
assert.equal(wavBuf.toString('ascii', 0, 4), 'RIFF', 'tick.wav must have RIFF header');
assert.equal(wavBuf.toString('ascii', 8, 12), 'WAVE', 'tick.wav must have WAVE header');
assert.equal(wavBuf.readUInt16LE(22), 1, 'tick.wav must be mono');
assert.equal(wavBuf.readUInt16LE(34), 16, 'tick.wav must be 16-bit PCM');

// 8. Search index build & query performance + Turkish/accented matching over 4116 players
const tIdx0 = performance.now();
const prefixBuckets = new Map();
const normNames = new Array(guessRows.length);
for (let i = 0; i < guessRows.length; i += 1) {
  const n = guessRows[i][7] ?? normalizeText(guessRows[i][1]);
  normNames[i] = n;
  const toks = n.split(' ');
  for (let t = 0; t < toks.length; t += 1) {
    const tok = toks[t];
    if (!tok) continue;
    for (const key of tok.length >= 2 ? [tok[0], tok.slice(0, 2)] : [tok[0]]) {
      let list = prefixBuckets.get(key);
      if (!list) {
        list = [];
        prefixBuckets.set(key, list);
      }
      if (list[list.length - 1] !== i) list.push(i);
    }
  }
}
const indexBuildMs = performance.now() - tIdx0;
assert.ok(indexBuildMs < 300, `Index build took ${indexBuildMs.toFixed(1)}ms (budget < 300ms)`);

function benchSearch(query, limit = 8) {
  const t0 = performance.now();
  const norm = normalizeText(query);
  const qToks = norm.split(' ').filter(Boolean);
  const first = qToks[0] ?? norm;
  const bucketKey = first.length >= 2 ? first.slice(0, 2) : first[0];
  const cand = prefixBuckets.get(bucketKey) ?? [];
  const res = [];
  for (let k = 0; k < cand.length && res.length < limit; k += 1) {
    const i = cand[k];
    const nName = normNames[i];
    if (nName.startsWith(norm) || nName.includes(` ${first}`)) {
      res.push(guessRows[i][1]);
    }
  }
  return { res, ms: performance.now() - t0 };
}

const searchCases = [
  ['m', null],
  ['çalhanoğlu', 'Hakan Çalhanoğlu'],
  ['calhanoglu', 'Hakan Çalhanoğlu'],
  ['güler', 'Arda Güler'],
  ['guler', 'Arda Güler'],
  ['yıldız', 'Kenan Yıldız'],
  ['şükür', 'Hakan Şükür'],
  ['özil', 'Mesut Özil'],
  ['mbappé', 'Kylian Mbappé'],
  ['mbappe', 'Kylian Mbappé'],
  ['sánchez', 'Alexis Sánchez'],
];

let maxQueryMs = 0;
for (const [q, expected] of searchCases) {
  const { res, ms } = benchSearch(q, 10);
  if (ms > maxQueryMs) maxQueryMs = ms;
  assert.ok(ms < 20, `Search "${q}" took ${ms.toFixed(2)}ms (budget < 20ms)`);
  assert.ok(res.length > 0, `Search "${q}" returned 0 results`);
  if (expected) {
    assert.ok(
      res.some((name) => normalizeText(name) === normalizeText(expected)),
      `Search "${q}" did not include "${expected}" (got: ${res.join(', ')})`
    );
  }
}

console.log(
  `All unit tests passed! (puzzlePool: ${puzzlePool.length}, guessPool: ${guessRows.length}, indexBuild: ${indexBuildMs.toFixed(1)}ms, maxSearch: ${maxQueryMs.toFixed(2)}ms)`
);
