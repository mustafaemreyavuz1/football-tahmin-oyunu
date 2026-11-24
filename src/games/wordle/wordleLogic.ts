import { WordleCellStatus } from '../../utils/share';

export const WORDLE_MAX_ATTEMPTS = 6;

/**
 * Evaluates a normalized uppercase guess against a normalized uppercase target
 * using standard two-pass Wordle duplicate-letter rules.
 */
export function evaluateWordleGuess(guess: string, target: string): WordleCellStatus[] {
  const len = target.length;
  const result: WordleCellStatus[] = new Array<WordleCellStatus>(len).fill('absent');
  const remainingCounts: Record<string, number> = {};

  // Pass 1: exact matches (green)
  for (let i = 0; i < len; i += 1) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
    } else {
      const ch = target[i];
      remainingCounts[ch] = (remainingCounts[ch] ?? 0) + 1;
    }
  }

  // Pass 2: present in wrong position (yellow)
  for (let i = 0; i < len; i += 1) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if ((remainingCounts[ch] ?? 0) > 0) {
      result[i] = 'present';
      remainingCounts[ch] -= 1;
    }
  }

  return result;
}

const PRIORITY: Record<WordleCellStatus, number> = {
  absent: 1,
  present: 2,
  correct: 3,
};

/**
 * Computes highest-priority status per letter for the on-screen keyboard.
 */
export function computeKeyboardStates(
  guesses: string[],
  evaluations: WordleCellStatus[][]
): Record<string, WordleCellStatus> {
  const map: Record<string, WordleCellStatus> = {};
  for (let r = 0; r < guesses.length; r += 1) {
    const word = guesses[r];
    const evalRow = evaluations[r];
    if (!evalRow) continue;
    for (let c = 0; c < word.length; c += 1) {
      const ch = word[c];
      const nextStatus = evalRow[c];
      const prevStatus = map[ch];
      if (!prevStatus || PRIORITY[nextStatus] > PRIORITY[prevStatus]) {
        map[ch] = nextStatus;
      }
    }
  }
  return map;
}
