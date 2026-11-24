import { GameId } from '../types';

/**
 * Epoch start date for daily puzzle indexing (YYYY-MM-DD local).
 */
const EPOCH_YEAR = 2025;
const EPOCH_MONTH = 0; // January (0-indexed)
const EPOCH_DAY = 1;

/**
 * Returns local calendar date key in YYYY-MM-DD format.
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Number of whole calendar days since EPOCH in local time.
 */
export function getDayNumber(date: Date = new Date()): number {
  const utcToday = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const utcEpoch = Date.UTC(EPOCH_YEAR, EPOCH_MONTH, EPOCH_DAY);
  return Math.floor((utcToday - utcEpoch) / 86_400_000);
}

/**
 * Deterministic string hash (FNV-1a 32-bit).
 */
function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Mulberry32 deterministic PRNG.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks a deterministic puzzle index for (gameId, date) from a pool of size `poolLength`.
 * Guarantees:
 * 1. Same puzzle for all players on the same date (no server required).
 * 2. Zero repeats within a full cycle of `poolLength` days (seeded Fisher-Yates permutation per cycle).
 */
export function getDailyPuzzleIndex(gameId: GameId, poolLength: number, date: Date = new Date()): number {
  if (poolLength <= 0) return 0;
  const dayNum = Math.abs(getDayNumber(date));
  const cycle = Math.floor(dayNum / poolLength);
  const positionInCycle = dayNum % poolLength;

  const seed = hashString(`football-tahmin-oyunu:${gameId}:cycle:${cycle}`);
  const rand = mulberry32(seed);

  const indices = Array.from({ length: poolLength }, (_, i) => i);
  for (let i = poolLength - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }

  return indices[positionInCycle];
}

/**
 * Returns formatted countdown string "SS:DD:SN" until local midnight.
 */
export function getTimeUntilMidnight(now: Date = new Date()): string {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const diffMs = Math.max(0, midnight.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
