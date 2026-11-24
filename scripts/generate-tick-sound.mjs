#!/usr/bin/env node
/**
 * Generates a copyright-free procedural UI tick sound (16-bit PCM mono WAV, 44.1 kHz, ~38 ms).
 * Soft damped sine + subtle transient click for TenaBall countdown steps.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../assets/sounds');
const outPath = path.join(outDir, 'tick.wav');

const SAMPLE_RATE = 44100;
const DURATION_SEC = 0.038; // 38 ms
const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SEC);
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

const dataSize = NUM_SAMPLES * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
const buffer = Buffer.alloc(44 + dataSize);

// RIFF / WAVE header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // PCM chunk size
buffer.writeUInt16LE(1, 20); // PCM format
buffer.writeUInt16LE(NUM_CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8), 28);
buffer.writeUInt16LE(NUM_CHANNELS * (BITS_PER_SAMPLE / 8), 32);
buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

// Deterministic pseudo-random for subtle transient click (first 3 ms)
let seed = 1234567;
const nextNoise = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 1073741823.5) - 1;
};

for (let i = 0; i < NUM_SAMPLES; i += 1) {
  const t = i / SAMPLE_RATE;
  // Fast attack (1.5 ms) + smooth exponential decay
  const attack = Math.min(1, t / 0.0015);
  const decay = Math.exp(-t * 115);
  const tone = Math.sin(2 * Math.PI * 1080 * t) * 0.72 + Math.sin(2 * Math.PI * 2160 * t) * 0.22;
  const click = t < 0.004 ? nextNoise() * Math.exp(-t * 600) * 0.25 : 0;
  const sample = Math.max(-1, Math.min(1, (tone + click) * attack * decay * 0.65));
  buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, buffer);
console.log(`Generated ${outPath} (${buffer.length} bytes, ${Math.round(DURATION_SEC * 1000)} ms)`);
