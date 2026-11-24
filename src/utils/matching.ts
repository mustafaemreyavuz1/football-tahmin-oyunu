import { extractSurnameFromFullName, normalizeText } from './normalization';

/**
 * Computes Levenshtein edit distance between two normalized strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

/**
 * Allowed edit distance threshold based on target string length.
 * Forgives small typos while preventing false positives on short names.
 */
function maxAllowedDistance(targetLength: number): number {
  if (targetLength <= 3) return 0;
  if (targetLength <= 6) return 1;
  if (targetLength <= 11) return 2;
  return 3;
}

/**
 * Checks if a user's typed guess matches a target footballer name.
 * - Accent-insensitive & case-insensitive
 * - Matches either full name OR extracted surname automatically (no hand-written aliases)
 * - Also matches compact forms (e.g. "debruyne" matches "De Bruyne")
 * - Forgives small typos via Levenshtein distance
 */
export function matchPlayerAnswer(guess: string, targetFullName: string): { matched: boolean; score: number } {
  const normGuess = normalizeText(guess);
  if (normGuess.length < 2) return { matched: false, score: Infinity };

  const normFull = normalizeText(targetFullName);
  const normSurname = extractSurnameFromFullName(targetFullName);
  const fullTokens = normFull.split(' ').filter(Boolean);
  const lastToken = fullTokens[fullTokens.length - 1] ?? normFull;

  const candidates = new Set<string>([
    normFull,
    normSurname,
    lastToken,
    normFull.replace(/\s+/g, ''),
    normSurname.replace(/\s+/g, ''),
  ]);

  // If the full name has a known single-word football moniker as the first token (e.g. "Neymar da Silva", "Pelé Nascimento")
  // only match first token if it is >= 5 chars AND exact match (or 1 typo for >= 7 chars)
  const compactGuess = normGuess.replace(/\s+/g, '');

  let bestDistance = Infinity;
  let matched = false;

  for (const candidate of candidates) {
    if (!candidate) continue;
    // Compare both spaced and compact forms
    const d1 = levenshteinDistance(normGuess, candidate);
    const d2 = levenshteinDistance(compactGuess, candidate.replace(/\s+/g, ''));
    const dist = Math.min(d1, d2);
    const threshold = maxAllowedDistance(candidate.length);

    if (dist <= threshold && dist < bestDistance) {
      bestDistance = dist;
      matched = true;
    }
  }

  return { matched, score: bestDistance };
}

/**
 * Finds the best matching unsolved answer index in a TenaBall answer list.
 * Returns -1 if no match.
 */
export function findBestTenaBallMatch(
  guess: string,
  answers: string[],
  solvedIndices: Set<number>
): { index: number; alreadySolved: boolean } {
  let bestUnsolvedIdx = -1;
  let bestUnsolvedScore = Infinity;
  let alreadySolvedMatch = false;

  for (let i = 0; i < answers.length; i += 1) {
    const res = matchPlayerAnswer(guess, answers[i]);
    if (res.matched) {
      if (solvedIndices.has(i)) {
        alreadySolvedMatch = true;
      } else if (res.score < bestUnsolvedScore) {
        bestUnsolvedScore = res.score;
        bestUnsolvedIdx = i;
      }
    }
  }

  if (bestUnsolvedIdx !== -1) {
    return { index: bestUnsolvedIdx, alreadySolved: false };
  }
  return { index: -1, alreadySolved: alreadySolvedMatch };
}
