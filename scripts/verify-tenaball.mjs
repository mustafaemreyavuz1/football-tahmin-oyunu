#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, '../src/data/tenaball.json');

const questions = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let verifiedCount = 0;
let unverifiedCount = 0;
const byCategory = {};
const issues = [];
const seenIds = new Set();

for (const q of questions) {
  if (q.verified === true) verifiedCount += 1;
  else unverifiedCount += 1;

  byCategory[q.category] = (byCategory[q.category] ?? 0) + 1;

  if (!q.id || seenIds.has(q.id)) {
    issues.push(`Duplicate or missing id: ${q.id}`);
  }
  seenIds.add(q.id);

  if (!Array.isArray(q.answers) || q.answers.length !== 10) {
    issues.push(`${q.id}: expected 10 answers, got ${q.answers?.length}`);
  } else {
    const uniq = new Set(q.answers.map((a) => a.trim().toLowerCase()));
    if (uniq.size !== 10) {
      issues.push(`${q.id}: duplicate answers detected`);
    }
  }

  if (!q.sourceUrl || !q.sourceUrl.startsWith('http')) {
    issues.push(`${q.id}: invalid sourceUrl`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.asOf ?? '')) {
    issues.push(`${q.id}: invalid asOf date (${q.asOf})`);
  }
  if ('aliases' in q) {
    issues.push(`${q.id}: manual aliases field is forbidden`);
  }
}

console.log('=== TenaBall Verification Report ===');
console.log(`Total lists     : ${questions.length}`);
console.log(`Verified (true) : ${verifiedCount}`);
console.log(`Unverified      : ${unverifiedCount}`);
console.log('');
console.log('By category:');
for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`  - ${cat}: ${count}`);
}

if (issues.length > 0) {
  console.error('\nSchema issues found:');
  for (const issue of issues) console.error(`  ! ${issue}`);
  process.exit(1);
}

console.log('\nSchema validation passed with 0 issues.');
