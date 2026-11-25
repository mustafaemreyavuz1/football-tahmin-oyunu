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

// --- Lazy, Precomputed Search & Lookup Index ---
interface GuessSearchIndex {
  byId: Map<string, number>;
  puzzleIdSet: Set<string>;
  normNames: string[];
  prefixBuckets: Map<string, number[]>;
  wordleValidSurnames: Set<string>;
}

let cachedIndex: GuessSearchIndex | null = null;
let devSearchCount = 0;

function ensureGuessIndex(): GuessSearchIndex {
  if (cachedIndex) return cachedIndex;

  const t0 = __DEV__ ? Date.now() : 0;

  const byId = new Map<string, number>();
  const puzzleIdSet = new Set(PUZZLE_POOL.map((p) => p.id));
  const normNames: string[] = new Array(GUESS_ROWS.length);
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
    const id = row[0];
    // Use build-time precomputed normName (row[7]) to avoid NFD/regex on Hermes
    const normName = row[7] ?? normalizeText(row[1]);

    byId.set(id, i);
    normNames[i] = normName;

    // Split precomputed ASCII normName by space (zero regex!)
    const tokens = normName.split(' ');
    for (let t = 0; t < tokens.length; t += 1) {
      const tok = tokens[t];
      if (!tok) continue;
      addBucket(tok[0], i);
      if (tok.length >= 2) {
        addBucket(tok.slice(0, 2), i);
      }
    }

    const lastTok = tokens[tokens.length - 1];
    if (lastTok && lastTok.length >= 2) {
      wordleValidSurnames.add(lastTok.toUpperCase());
    }
    // Also register compact multi-word surname for Wordle if surname has spaces
    const rawSurname = row[2];
    if (rawSurname.includes(' ') || rawSurname.includes('-') || rawSurname.includes("'")) {
      const compact = normalizeForWordle(rawSurname);
      if (compact.length >= 2) {
        wordleValidSurnames.add(compact);
      }
    }
  }

  cachedIndex = {
    byId,
    puzzleIdSet,
    normNames,
    prefixBuckets,
    wordleValidSurnames,
  };

  if (__DEV__) {
    console.log(
      `[SearchPerf] guessPool index built for ${GUESS_ROWS.length} players in ${Date.now() - t0} ms`
    );
  }

  return cachedIndex;
}

/**
 * Warms the search index once after initial render (via InteractionManager)
 * so the very first keystroke has zero indexing latency.
 */
export function warmGuessIndex(): void {
  ensureGuessIndex();
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
  const rowIdx = ensureGuessIndex().byId.get(id);
  return rowIdx !== undefined ? tupleToGuessPlayer(GUESS_ROWS[rowIdx]) : undefined;
}

export function getPuzzlePlayerById(id: string): PuzzlePlayer | undefined {
  return PUZZLE_POOL.find((p) => p.id === id);
}

/**
 * O(1) validation for Football Wordle guesses against the 4000+ player guessPool.
 */
export function isValidWordleSurname(normalizedUpperGuess: string): boolean {
  return ensureGuessIndex().wordleValidSurnames.has(normalizedUpperGuess);
}

/**
 * Builds a Wikimedia Commons thumbnail URL via Special:FilePath (used as fallback / reference).
 */
export function getWikimediaImageUrl(imageFile: string, width: number = 480): string {
  if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
    return imageFile;
  }
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}?width=${width}`;
}

/**
 * Fast, non-fuzzy indexed autocomplete search over guessPool (prefix & word-start matching only).
 * - Uses 1-char / 2-char token prefix buckets (never scans all 4000+ rows on normal queries)
 * - Zero localeCompare('tr') calls (preserves pre-sorted rowIdx order in O(1))
 * - Limited to at most `limit` (default 8) items
 */
export function searchGuessPool(query: string, limit: number = 8): GuessPlayer[] {
  const t0 = __DEV__ ? Date.now() : 0;
  const norm = normalizeText(query);
  if (norm.length < 1) return [];

  const idx = ensureGuessIndex();
  const queryTokens = norm.split(' ').filter(Boolean);
  const firstToken = queryTokens[0] ?? norm;
  const bucketKey = firstToken.length >= 2 ? firstToken.slice(0, 2) : firstToken[0];
  const candidateIndices = idx.prefixBuckets.get(bucketKey);
  if (!candidateIndices || candidateIndices.length === 0) return [];

  const cap = Math.min(limit, 10);
  // Tiered buckets avoid sorting thousands of candidates (preserves alphabetical rowIdx order)
  const tier0Puzzle: number[] = []; // full name startsWith(norm) & in puzzlePool
  const tier0Other: number[] = [];  // full name startsWith(norm)
  const tier1Puzzle: number[] = []; // word-start match & in puzzlePool
  const tier1Other: number[] = [];  // word-start match

  for (let k = 0; k < candidateIndices.length; k += 1) {
    const i = candidateIndices[k];
    const nName = idx.normNames[i];

    let matchedTier = -1;
    if (nName.startsWith(norm)) {
      matchedTier = 0;
    } else if (queryTokens.length === 1) {
      // Word-start match: " " + token
      if (nName.includes(` ${firstToken}`)) {
        matchedTier = 1;
      }
    } else {
      // Multi-word query: every token must match start of a word in nName
      let allMatch = true;
      for (let t = 0; t < queryTokens.length; t += 1) {
        const qt = queryTokens[t];
        if (!nName.startsWith(qt) && !nName.includes(` ${qt}`)) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) matchedTier = 1;
    }

    if (matchedTier === -1) continue;

    const isPuzzle = idx.puzzleIdSet.has(GUESS_ROWS[i][0]);
    if (matchedTier === 0) {
      if (isPuzzle) {
        if (tier0Puzzle.length < cap) tier0Puzzle.push(i);
      } else if (tier0Other.length < cap) {
        tier0Other.push(i);
      }
    } else if (isPuzzle) {
      if (tier1Puzzle.length < cap) tier1Puzzle.push(i);
    } else if (tier1Other.length < cap) {
      tier1Other.push(i);
    }

    // Early exit once highest-priority tier is already full
    if (tier0Puzzle.length >= cap) break;
  }

  const picked = [...tier0Puzzle, ...tier0Other, ...tier1Puzzle, ...tier1Other].slice(0, cap);
  const results = picked.map((rowIdx) => tupleToGuessPlayer(GUESS_ROWS[rowIdx]));

  if (__DEV__) {
    devSearchCount += 1;
    const label = devSearchCount === 1 ? 'first search' : `search #${devSearchCount}`;
    console.log(
      `[SearchPerf] ${label} ("${query}") -> ${results.length} results in ${Date.now() - t0} ms (bucket=${candidateIndices.length})`
    );
  }

  return results;
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
