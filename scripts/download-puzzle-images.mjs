#!/usr/bin/env node
/**
 * Downloads verified, small (~400px JPEG) copies of puzzlePool player images from Wikimedia Commons
 * with a polite User-Agent (repo URL only, no email) and rate limiting, re-verifies each license
 * for redistribution, removes any unverified/non-redistributable player from puzzlePool.json,
 * and generates src/data/playerImages.ts static require() map for Expo bundling.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src/data');
const ASSETS_DIR = path.join(ROOT, 'assets/players');
const PUZZLE_PATH = path.join(DATA_DIR, 'puzzlePool.json');
const MAP_PATH = path.join(DATA_DIR, 'playerImages.ts');

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT =
  'FootballTahminOyunu/1.0 (https://github.com/mustafaemreyavuz1/football-tahmin-oyunu)';
const TARGET_WIDTH = 400;
const DELAY_MS = 180;

const ALLOWED_LICENSE_RE = /\b(cc\s*by|cc0|public domain|pd|gfdl|free)\b/i;
const DISALLOWED_LICENSE_RE = /\b(nc|nd|non-commercial|no-derivatives|fair use|copyrighted)\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function verifyLicensesBatch(players) {
  const verifiedMap = new Map();
  for (let i = 0; i < players.length; i += 40) {
    const batch = players.slice(i, i + 40);
    const titles = batch.map((p) => `File:${p.imageFile}`).join('|');
    const url = `${COMMONS_API}?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=${TARGET_WIDTH}&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) continue;
    const data = await res.json();

    const normMap = new Map();
    for (const n of data.query?.normalized || []) normMap.set(n.from, n.to);
    const pageByTitle = new Map();
    for (const pg of Object.values(data.query?.pages || {})) pageByTitle.set(pg.title, pg);

    for (const p of batch) {
      const rawTitle = `File:${p.imageFile}`;
      const normTitle = normMap.get(rawTitle) || rawTitle;
      const pg = pageByTitle.get(normTitle);
      const info = pg?.imageinfo?.[0];
      if (!pg || 'missing' in pg || !info?.extmetadata) continue;

      const meta = info.extmetadata;
      const license = (meta.LicenseShortName?.value || '').trim();
      if (!ALLOWED_LICENSE_RE.test(license) || DISALLOWED_LICENSE_RE.test(license)) continue;

      const artistRaw = meta.Artist?.value || 'Wikimedia Commons';
      const artist = artistRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
      const thumbUrl = info.thumburl || info.url;
      if (!thumbUrl) continue;

      verifiedMap.set(p.id, {
        thumbUrl,
        imageLicense: license,
        imageAttribution: `Wikimedia Commons — ${artist}`,
      });
    }
    await sleep(150);
  }
  return verifiedMap;
}

async function downloadWithRetry(url, attempt = 1) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'image/jpeg,image/webp,image/*;q=0.8' },
    redirect: 'follow',
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await sleep(attempt * 1500);
    return downloadWithRetry(url, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.startsWith('image/')) {
    throw new Error(`Unexpected content-type: ${ct}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) {
    throw new Error(`Image too small (${buf.length} bytes)`);
  }
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
  return { buf, ext };
}

async function main() {
  const puzzleData = JSON.parse(fs.readFileSync(PUZZLE_PATH, 'utf8'));
  const players = puzzleData.players;

  console.log(`Re-verifying licenses for ${players.length} puzzlePool players on Wikimedia Commons...`);
  const verifiedMap = await verifyLicensesBatch(players);
  console.log(`License verified: ${verifiedMap.size}/${players.length}`);

  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const keptPlayers = [];
  const removedPlayers = [];
  const assetEntries = [];
  let totalBytes = 0;

  for (let i = 0; i < players.length; i += 1) {
    const p = players[i];
    const meta = verifiedMap.get(p.id);
    if (!meta) {
      removedPlayers.push({ id: p.id, name: p.name, reason: 'Lisans doğrulanamadı veya yeniden dağıtıma uygun değil' });
      continue;
    }

    // Reuse already-downloaded file if present
    const existingJpg = path.join(ASSETS_DIR, `${p.id}.jpg`);
    const existingPng = path.join(ASSETS_DIR, `${p.id}.png`);
    const existingWebp = path.join(ASSETS_DIR, `${p.id}.webp`);
    let localFile = null;

    if (fs.existsSync(existingJpg) && fs.statSync(existingJpg).size > 1000) {
      localFile = `${p.id}.jpg`;
    } else if (fs.existsSync(existingPng) && fs.statSync(existingPng).size > 1000) {
      localFile = `${p.id}.png`;
    } else if (fs.existsSync(existingWebp) && fs.statSync(existingWebp).size > 1000) {
      localFile = `${p.id}.webp`;
    }

    if (!localFile) {
      try {
        const { buf, ext } = await downloadWithRetry(meta.thumbUrl);
        localFile = `${p.id}.${ext}`;
        fs.writeFileSync(path.join(ASSETS_DIR, localFile), buf);
        await sleep(DELAY_MS);
      } catch (err) {
        removedPlayers.push({ id: p.id, name: p.name, reason: `İndirilemedi (${err.message})` });
        continue;
      }
    }

    const size = fs.statSync(path.join(ASSETS_DIR, localFile)).size;
    totalBytes += size;
    keptPlayers.push({
      ...p,
      imageLicense: meta.imageLicense,
      imageAttribution: meta.imageAttribution,
    });
    assetEntries.push({ id: p.id, file: localFile });

    if ((i + 1) % 40 === 0) {
      console.log(`  Progress: ${i + 1}/${players.length} (kept: ${keptPlayers.length}, ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
    }
  }

  // Update puzzlePool.json if any players were removed or attributions refreshed
  puzzleData.players = keptPlayers;
  puzzleData.meta.count = keptPlayers.length;
  puzzleData.meta.fetchedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(PUZZLE_PATH, JSON.stringify(puzzleData, null, 2) + '\n', 'utf8');

  // Generate static require map src/data/playerImages.ts
  const lines = [
    '// Auto-generated by scripts/download-puzzle-images.mjs — DO NOT EDIT MANUALLY',
    'import { ImageSourcePropType } from \'react-native\';',
    '',
    'export const PLAYER_IMAGES: Record<string, ImageSourcePropType> = {',
    ...assetEntries.map(
      ({ id, file }) => `  '${id}': require('../../assets/players/${file}'),`
    ),
    '};',
    '',
  ];
  fs.writeFileSync(MAP_PATH, lines.join('\n'), 'utf8');

  console.log('\n=== Image Bundling Summary ===');
  console.log(`Kept puzzlePool players : ${keptPlayers.length}`);
  console.log(`Removed players         : ${removedPlayers.length}`);
  for (const r of removedPlayers) {
    console.log(`  - ${r.name} (${r.id}): ${r.reason}`);
  }
  console.log(`Total image size        : ${(totalBytes / 1024 / 1024).toFixed(2)} MB (${Math.round(totalBytes / Math.max(1, keptPlayers.length) / 1024)} KB avg)`);
  console.log(`Generated map           : src/data/playerImages.ts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
