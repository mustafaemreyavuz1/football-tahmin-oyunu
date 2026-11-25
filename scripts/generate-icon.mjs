#!/usr/bin/env node
/**
 * Zero-dependency procedural PNG generator for Football Tahmin Oyunu branding assets.
 * Produces original, minimal football + question-mark icons (no club logos, brands, or crests):
 *   - assets/branding/icon.png          (1024x1024, opaque #1B6B3A background)
 *   - assets/branding/adaptive-icon.png (1024x1024, transparent background, safe-zone ~60%)
 *   - assets/branding/splash.png        (1024x1024, #1B6B3A background, centered mark)
 *   - assets/branding/favicon.png       (48x48, opaque #1B6B3A background)
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../assets/branding');

// --- Minimal CRC32 + PNG Encoder (RGBA 8-bit) ---
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Signed Distance Field Helpers (normalized coordinates [-1, 1]) ---
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/**
 * Signed distance to a clean rounded question mark '?' centered around (0, 0), scaled by `s`.
 */
function sdQuestionMark(px, py, s) {
  const x = px / s;
  const y = py / s;
  const stroke = 0.145;

  // Top hook arc: center (0, -0.22), radius 0.28, angle from ~205 deg to ~35 deg (clockwise)
  const cx = 0.0;
  const cy = -0.22;
  const r = 0.27;
  const dx = x - cx;
  const dy = y - cy;
  const ang = Math.atan2(dy, dx); // -PI..PI, 0 is right, -PI/2 is top
  // Arc spans from left-ish (-0.95*PI or +0.92*PI) over top (-PI/2) to lower-right (+0.22*PI)
  let dArc;
  const inArc = ang <= 0.22 * Math.PI || ang >= 0.92 * Math.PI;
  if (inArc) {
    dArc = Math.abs(Math.hypot(dx, dy) - r) - stroke;
  } else {
    const p1x = cx + r * Math.cos(0.92 * Math.PI);
    const p1y = cy + r * Math.sin(0.92 * Math.PI);
    const p2x = cx + r * Math.cos(0.22 * Math.PI);
    const p2y = cy + r * Math.sin(0.22 * Math.PI);
    dArc = Math.min(Math.hypot(x - p1x, y - p1y), Math.hypot(x - p2x, y - p2y)) - stroke;
  }

  // Diagonal connector from arc end to vertical stem
  const pEndX = cx + r * Math.cos(0.22 * Math.PI);
  const pEndY = cy + r * Math.sin(0.22 * Math.PI);
  const dConn = sdSegment(x, y, pEndX, pEndY, 0.0, 0.12) - stroke;
  // Short vertical stem
  const dStem = sdSegment(x, y, 0.0, 0.12, 0.0, 0.24) - stroke;
  // Bottom dot
  const dDot = sdCircle(x, y, 0.0, 0.50, 0.125);

  return Math.min(dArc, dConn, dStem, dDot) * s;
}

function blendPixel(dst, idx, r, g, b, a) {
  if (a <= 0) return;
  const srcA = clamp(a, 0, 1);
  const dstA = dst[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  dst[idx] = Math.round((r * srcA + dst[idx] * dstA * (1 - srcA)) / outA);
  dst[idx + 1] = Math.round((g * srcA + dst[idx + 1] * dstA * (1 - srcA)) / outA);
  dst[idx + 2] = Math.round((b * srcA + dst[idx + 2] * dstA * (1 - srcA)) / outA);
  dst[idx + 3] = Math.round(outA * 255);
}

/**
 * Renders the Football Tahmin Oyunu emblem into an RGBA buffer.
 * @param {number} size
 * @param {{ transparentBg: boolean; markScale: number; showPitchRing: boolean }} opts
 */
function renderIcon(size, { transparentBg, markScale, showPitchRing }) {
  const rgba = Buffer.alloc(size * size * 4);
  const aa = 2.4 / size; // anti-aliasing width in normalized coords

  // Base football green #1B6B3A = (27, 107, 58)
  const bgR = 27;
  const bgG = 107;
  const bgB = 58;

  // Darker accent green #114726 = (17, 71, 38)
  const darkR = 17;
  const darkG = 71;
  const darkB = 38;

  // Golden highlight #F5C542 = (245, 197, 66)
  const goldR = 245;
  const goldG = 197;
  const goldB = 66;

  // Precompute 5-fold football panel ring points around the ball edge
  const panelAngles = [0, 1, 2, 3, 4].map((k) => -Math.PI / 2 + (k * 2 * Math.PI) / 5);

  for (let y = 0; y < size; y += 1) {
    const ny = ((y + 0.5) / size) * 2 - 1;
    for (let x = 0; x < size; x += 1) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      const idx = (y * size + x) * 4;

      // 1. Background
      if (!transparentBg) {
        const distCenter = Math.hypot(nx, ny);
        const vig = clamp(1 - distCenter * 0.22, 0.78, 1.04);
        rgba[idx] = Math.round(clamp(bgR * vig, 0, 255));
        rgba[idx + 1] = Math.round(clamp(bgG * vig, 0, 255));
        rgba[idx + 2] = Math.round(clamp(bgB * vig, 0, 255));
        rgba[idx + 3] = 255;
      }

      // 2. Subtle football pitch center-circle ring (for opaque icon & splash)
      if (showPitchRing && !transparentBg) {
        const dRing = Math.abs(Math.hypot(nx, ny) - markScale * 1.18) - 0.016;
        const aRing = 1 - smoothstep(-aa, aa, dRing);
        if (aRing > 0) blendPixel(rgba, idx, 255, 255, 255, aRing * 0.22);
      }

      // 3. Soft drop shadow beneath football
      const dShadow = sdCircle(nx, ny - 0.03 * markScale, 0, 0, markScale * 0.99);
      const aShadow = (1 - smoothstep(-0.08, 0.08, dShadow)) * 0.26;
      if (aShadow > 0 && !transparentBg) {
        blendPixel(rgba, idx, 8, 32, 18, aShadow);
      }

      // 4. White football sphere
      const ballR = markScale * 0.95;
      const dBall = sdCircle(nx, ny, 0, 0, ballR);
      const aBall = 1 - smoothstep(-aa, aa, dBall);
      if (aBall > 0) {
        // Subtle 3D shading on white ball
        const shade = clamp(1 - Math.hypot(nx + 0.2 * markScale, ny + 0.25 * markScale) * 0.12, 0.88, 1);
        const w = Math.round(252 * shade);
        blendPixel(rgba, idx, w, w, Math.round(248 * shade), aBall);

        // Minimalist geometric football edge panels (5 subtle dark-green pentagon-like arcs on perimeter)
        for (const ang of panelAngles) {
          const px = Math.cos(ang) * ballR * 1.04;
          const py = Math.sin(ang) * ballR * 1.04;
          const dPanel = sdCircle(nx, ny, px, py, ballR * 0.30);
          const aPanel = (1 - smoothstep(-aa, aa, dPanel)) * aBall;
          if (aPanel > 0) {
            blendPixel(rgba, idx, darkR, darkG, darkB, aPanel);
          }
        }

        // Subtle golden inner badge ring
        const dInnerRing = Math.abs(Math.hypot(nx, ny) - ballR * 0.62) - 0.022 * markScale;
        const aInnerRing = (1 - smoothstep(-aa, aa, dInnerRing)) * aBall;
        if (aInnerRing > 0) {
          blendPixel(rgba, idx, goldR, goldG, goldB, aInnerRing * 0.9);
        }

        // Crisp dark-green '?' mark in center
        const dQ = sdQuestionMark(nx, ny, ballR * 0.72);
        const aQ = (1 - smoothstep(-aa, aa, dQ)) * aBall;
        if (aQ > 0) {
          blendPixel(rgba, idx, darkR, darkG, darkB, aQ);
        }
      }
    }
  }

  return encodePng(size, size, rgba);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  {
    name: 'icon.png',
    size: 1024,
    opts: { transparentBg: false, markScale: 0.72, showPitchRing: true },
  },
  {
    name: 'adaptive-icon.png',
    size: 1024,
    // Safe zone is central ~66% (radius 0.66 in [-1, 1]); markScale 0.56 keeps entire ball comfortably inside
    opts: { transparentBg: true, markScale: 0.56, showPitchRing: false },
  },
  {
    name: 'splash.png',
    size: 1024,
    opts: { transparentBg: false, markScale: 0.48, showPitchRing: true },
  },
  {
    name: 'favicon.png',
    size: 48,
    opts: { transparentBg: false, markScale: 0.80, showPitchRing: false },
  },
];

for (const t of targets) {
  const png = renderIcon(t.size, t.opts);
  const outPath = path.join(OUT_DIR, t.name);
  fs.writeFileSync(outPath, png);
  console.log(
    `Generated assets/branding/${t.name} (${t.size}x${t.size}, ${(png.length / 1024).toFixed(1)} KB)`
  );
}
