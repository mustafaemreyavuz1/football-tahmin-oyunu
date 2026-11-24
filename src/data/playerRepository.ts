import puzzlePoolFile from './puzzlePool.json';
import guessPoolFile from './guessPool.json';
import { GuessPlayer, GuessPoolTuple, PuzzlePlayer } from '../types';
import { normalizeForWordle, normalizeText } from '../utils/normalization';
import { getDailyPuzzleIndex } from '../utils/daily';

interface PuzzlePoolFile {
  meta: {
    source: string;
    license: string;
    fetchedAt: string;
    count: number;
  };
  players: PuzzlePlayer[];
}

interface GuessPoolFile {
  meta: {
    source: string;
    license: string;
    fetchedAt: string;
    format: string;
    count: number;
  };
  rows: GuessPoolTuple[];
}

const PUZZLE_DATA = puzzlePoolFile as PuzzlePoolFile;
const GUESS_DATA = guessPoolFile as GuessPoolFile;

const PUZZLE_POOL: PuzzlePlayer[] = PUZZLE_DATA.players;
const GUESS_ROWS: GuessPoolTuple[] = GUESS_DATA.rows;

/**
 * Who Are Ya answers come strictly from puzzlePool (verified photo, license, attribution).
 */
const WHO_ARE_YA_POOL: PuzzlePlayer[] = PUZZLE_POOL.filter(
  (p) => Boolean(p.imageFile && p.imageLicense && p.imageAttribution)
);

/**
 * Football Wordle answers come strictly from puzzlePool (valid 3..14 char normalized surname).
 */
const WORDLE_POOL: PuzzlePlayer[] = PUZZLE_POOL.filter((p) => {
  const norm = normalizeForWordle(p.surname);
  return norm.length >= 3 && norm.length <= 14;
});

function tupleToGuessPlayer(row: GuessPoolTuple): GuessPlayer {
  return {
    id: row[0],
    name: row[1],
    surname: row[2],
    nationality: row[3],
    position: row[4],
    clubs: row[5],
    birthYear: row[6] ?? undefined,
  };
}

// --- Lazy Search & Lookup Index (zero startup cost) ---
interface GuessSearchIndex {
  byId: Map<string, GuessPlayer>;
  byNormName: Map<string, GuessPlayer>;
  puzzleIdSet: Set<string>;
  normNames: string[];
  normSurnames: string[];
  prefixBuckets: Map<string, number[]>;
  wordleValidSurnames: Set<string>;
}

let cachedIndex: GuessSearchIndex | null = null;

function ensureGuessIndex(): GuessSearchIndex {
  if (cachedIndex) return cachedIndex;

  const byId = new Map<string, GuessPlayer>();
  const byNormName = new Map<string, GuessPlayer>();
  const puzzleIdSet = new Set(PUZZLE_POOL.map((p) => p.id));
  const normNames: string[] = new Array(GUESS_ROWS.length);
  const normSurnames: string[] = new Array(GUESS_ROWS.length);
  const prefixBuckets = new Map<string, number[]>();
  const wordleValidSurnames = new Set<string>();

  const addBucket = (key: string, idx: number) => {
    let list = prefixBuckets.get(key);
    if (!list) {
      list = [];
      prefixBuckets.set(key, list);
    }
    if (list[list.length - 1] !== idx) {
      list.push(idx);
    }
  };

  for (let i = 0; i < GUESS_ROWS.length; i += 1) {
    const row = GUESS_ROWS[i];
    const player = tupleToGuessPlayer(row);
    const normName = normalizeText(player.name);
    const normSurname = normalizeText(player.surname);

    byId.set(player.id, player);
    byNormName.set(normName, player);
    normNames[i] = normName;
    normSurnames[i] = normSurname;

    // Register Wordle-valid surname (and last token) in O(1) lookup set
    const wordleSurname = normalizeForWordle(player.surname);
    if (wordleSurname.length >= 2) {
      wordleValidSurnames.add(wordleSurname);
    }
    const tokens = normName.split(' ').filter(Boolean);
    for (const tok of tokens) {
      if (tok.length >= 2) {
        addBucket(tok.slice(0, 2), i);
      }
      if (tok.length === 1) {
        addBucket(tok, i);
      }
    }
    const lastTok = tokens[tokens.length - 1];
    if (lastTok && lastTok.length >= 2) {
      wordleValidSurnames.add(lastTok.toUpperCase());
    }
  }

  cachedIndex = {
    byId,
    byNormName,
    puzzleIdSet,
    normNames,
    normSurnames,
    prefixBuckets,
    wordleValidSurnames,
  };
  return cachedIndex;
}

// --- Pool Getters ---
export function getPuzzlePool(): PuzzlePlayer[] {
  return PUZZLE_POOL;
}

export function getGuessPoolCount(): number {
  return GUESS_ROWS.length;
}

export function getPoolMeta() {
  return {
    puzzlePool: PUZZLE_DATA.meta,
    guessPool: GUESS_DATA.meta,
  };
}

export function getWhoAreYaPool(): PuzzlePlayer[] {
  return WHO_ARE_YA_POOL;
}

export function getWordlePool(): PuzzlePlayer[] {
  return WORDLE_POOL;
}

export function getGuessPlayerById(id: string): GuessPlayer | undefined {
  return ensureGuessIndex().byId.get(id);
}

export function getPuzzlePlayerById(id: string): PuzzlePlayer | undefined {
  return PUZZLE_POOL.find((p) => p.id === id);
}

/**
 * O(1) validation for Football Wordle guesses against the 2000+ player guessPool.
 */
export function isValidWordleSurname(normalizedUpperGuess: string): boolean {
  return ensureGuessIndex().wordleValidSurnames.has(normalizedUpperGuess);
}

/**
 * Builds a Wikimedia Commons thumbnail URL via Special:FilePath.
 */
export function getWikimediaImageUrl(imageFile: string, width: number = 480): string {
  if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
    return imageFile;
  }
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}?width=${width}`;
}

/**
 * Fast indexed accent-insensitive autocomplete search over the 2000+ guessPool.
 * Uses 2-char token prefix buckets to avoid full linear scans on every keystroke.
 */
export function searchGuessPool(query: string, limit: number = 8): GuessPlayer[] {
  const norm = normalizeText(query);
  if (norm.length < 1) return [];

  const idx = ensureGuessIndex();
  const queryTokens = norm.split(' ').filter(Boolean);
  const firstToken = queryTokens[0] ?? norm;

  // Candidate row indices: use 2-char prefix bucket when possible
  let candidateIndices: number[] | null = null;
  if (firstToken.length >= 2) {
    candidateIndices = idx.prefixBuckets.get(firstToken.slice(0, 2)) ?? [];
  }

  const scored: { rowIdx: number; rank: number; isPuzzle: boolean }[] = [];
  const scanIndices = candidateIndices ?? Array.from({ length: GUESS_ROWS.length }, (_, i) => i);

  for (let k = 0; k < scanIndices.length; k += 1) {
    const i = scanIndices[k];
    const nName = idx.normNames[i];
    const nSurname = idx.normSurnames[i];

    let rank = -1;
    if (nName.startsWith(norm) || nSurname.startsWith(norm)) {
      rank = 0;
    } else if (queryTokens.every((t) => nName.includes(t))) {
      rank = 1;
    }

    if (rank !== -1) {
      const id = GUESS_ROWS[i][0];
      scored.push({ rowIdx: i, rank, isPuzzle: idx.puzzleIdSet.has(id) });
    }
  }

  // Fallback substring scan only if prefix bucket yielded fewer than limit results and query >= 3 chars
  if (candidateIndices && scored.length < limit && norm.length >= 3) {
    const already = new Set(scored.map((s) => s.rowIdx));
    for (let i = 0; i < GUESS_ROWS.length; i += 1) {
      if (already.has(i)) continue;
      if (idx.normNames[i].includes(norm)) {
        const id = GUESS_ROWS[i][0];
        scored.push({ rowIdx: i, rank: 2, isPuzzle: idx.puzzleIdSet.has(id) });
        if (scored.length >= limit * 4) break;
      }
    }
  }

  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(b.isPuzzle) - Number(a.isPuzzle) ||
      GUESS_ROWS[a.rowIdx][1].localeCompare(GUESS_ROWS[b.rowIdx][1], 'tr')
  );

  return scored.slice(0, limit).map((s) => tupleToGuessPlayer(GUESS_ROWS[s.rowIdx]));
}

// --- Daily & Unlimited Puzzle Selection (STRICTLY from puzzlePool) ---
export function getDailyWhoAreYaPlayer(date: Date = new Date()): PuzzlePlayer {
  const idx = getDailyPuzzleIndex('who-are-ya', WHO_ARE_YA_POOL.length, date);
  return WHO_ARE_YA_POOL[idx];
}

export function getRandomWhoAreYaPlayer(excludeId?: string): PuzzlePlayer {
  const candidates = excludeId
    ? WHO_ARE_YA_POOL.filter((p) => p.id !== excludeId)
    : WHO_ARE_YA_POOL;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getDailyWordlePlayer(date: Date = new Date()): PuzzlePlayer {
  const idx = getDailyPuzzleIndex('wordle', WORDLE_POOL.length, date);
  return WORDLE_POOL[idx];
}

export function getRandomWordlePlayer(excludeId?: string): PuzzlePlayer {
  const candidates = excludeId
    ? WORDLE_POOL.filter((p) => p.id !== excludeId)
    : WORDLE_POOL;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
