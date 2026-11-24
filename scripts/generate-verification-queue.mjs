#!/usr/bin/env node
/**
 * Generates an easy-to-review TenaBall verification queue in both Markdown and CSV:
 *   - docs/tenaball-verification-queue.md
 *   - docs/tenaball-verification-queue.csv
 *
 * Sorted by priority (Süper Lig, Türk Futbolu, Şampiyonlar Ligi, Dünya Kupası, Ödüller, top 5 leagues, Milli Takımlar).
 * Excludes hidden: true lists from the active queue (lists them separately at the bottom of the MD file).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '../src/data/tenaball.json');
const DOCS_DIR = path.resolve(__dirname, '../docs');

const CATEGORY_PRIORITY = {
  'Süper Lig': 1,
  'Türk Futbolu': 2,
  'Şampiyonlar Ligi': 3,
  'Dünya Kupası': 4,
  EURO: 5,
  'Ödüller': 6,
  'Premier League': 7,
  'La Liga': 8,
  'Serie A': 9,
  Bundesliga: 10,
  'Ligue 1': 11,
  'Milli Takımlar': 12,
  'Avrupa Kupaları': 13,
  Turnuvalar: 14,
};

const questions = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const active = questions
  .filter((q) => !q.hidden)
  .sort(
    (a, b) =>
      (CATEGORY_PRIORITY[a.category] ?? 99) - (CATEGORY_PRIORITY[b.category] ?? 99) ||
      a.id.localeCompare(b.id)
  );
const hidden = questions.filter((q) => q.hidden === true);

fs.mkdirSync(DOCS_DIR, { recursive: true });

// 1. Markdown table
const mdLines = [
  '# TenaBall Doğrulama Sırası (Verification Queue)',
  '',
  `Toplam aktif (gizli olmayan) liste: **${active.length}** | Doğrulanmış: **${active.filter((q) => q.verified).length}** | Doğrulama bekleyen: **${active.filter((q) => !q.verified).length}** | Gizli (` + '`hidden: true`' + `): **${hidden.length}**`,
  '',
  '> **Nasıl kullanılır?** Kaynak URL\'yi açıp 10 cevabı kontrol ettikten sonra `src/data/tenaball.json` içindeki ilgili kaydın `"verified": true` değerini güncelleyin. Uygulama yalnızca `verified: true` ve gizli olmayan listeleri gösterir.',
  '',
  '| Sıra | ID | Durum | Kategori | Başlık | 10 Cevap | Kaynak URL |',
  '|---:|---|---|---|---|---|---|',
];

active.forEach((q, idx) => {
  const status = q.verified ? '✅' : '⬜';
  const answersText = q.answers.map((a, i) => `${i + 1}. ${a}`).join('<br>');
  const safeTitle = q.title.replace(/\|/g, '\\|');
  mdLines.push(
    `| ${idx + 1} | \`${q.id}\` | ${status} | ${q.category} | ${safeTitle} | ${answersText} | [Kaynak](${q.sourceUrl}) |`
  );
});

if (hidden.length > 0) {
  mdLines.push(
    '',
    '## Gizli Listeler (`hidden: true` — `guessPool` Eksik Cevap Nedeniyle Devre Dışı)',
    '',
    '| ID | Kategori | Başlık | Kaynak URL |',
    '|---|---|---|---|'
  );
  for (const q of hidden) {
    mdLines.push(`| \`${q.id}\` | ${q.category} | ${q.title.replace(/\|/g, '\\|')} | [Kaynak](${q.sourceUrl}) |`);
  }
}

fs.writeFileSync(path.join(DOCS_DIR, 'tenaball-verification-queue.md'), mdLines.join('\n') + '\n', 'utf8');

// 2. CSV export (Excel / Google Sheets friendly, UTF-8 with BOM)
const csvEscape = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csvLines = [
  ['Sira', 'ID', 'Verified', 'Kategori', 'Zorluk', 'Baslik', 'Cevaplar_1_10', 'Kaynak_URL', 'AsOf'].join(','),
];

active.forEach((q, idx) => {
  csvLines.push(
    [
      idx + 1,
      q.id,
      q.verified ? 'true' : 'false',
      q.category,
      q.difficulty,
      q.title,
      q.answers.map((a, i) => `${i + 1}. ${a}`).join(' | '),
      q.sourceUrl,
      q.asOf,
    ]
      .map(csvEscape)
      .join(',')
  );
});

fs.writeFileSync(
  path.join(DOCS_DIR, 'tenaball-verification-queue.csv'),
  '\uFEFF' + csvLines.join('\n') + '\n',
  'utf8'
);

console.log(`Generated verification queue for ${active.length} active lists (+${hidden.length} hidden):`);
console.log('  - docs/tenaball-verification-queue.md');
console.log('  - docs/tenaball-verification-queue.csv');
