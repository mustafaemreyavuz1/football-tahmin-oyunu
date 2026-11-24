import { GuessPlayer, PuzzlePlayer } from '../../types';

export const WHO_ARE_YA_MAX_ATTEMPTS = 6;

/**
 * Blur intensity (px / native blurRadius) by wrong-guess count.
 * Starts heavily blurred and progressively clears with each wrong guess.
 */
export const BLUR_LEVELS = [26, 20, 14, 9, 5, 2, 0] as const;

export interface WhoAreYaGuessFeedback {
  guessedPlayer: GuessPlayer;
  isCorrect: boolean;
  nationalityMatch: boolean;
  positionMatch: boolean;
  sharedClub: string | null;
  birthYearComparison: 'exact' | 'higher' | 'lower' | 'unknown';
}

export function getBlurAmount(wrongGuesses: number, revealed: boolean): number {
  if (revealed) return 0;
  const idx = Math.min(wrongGuesses, BLUR_LEVELS.length - 1);
  return BLUR_LEVELS[idx];
}

export function evaluateWhoAreYaGuess(
  guessed: GuessPlayer,
  target: PuzzlePlayer
): WhoAreYaGuessFeedback {
  const isCorrect = guessed.id === target.id;
  const nationalityMatch = guessed.nationality === target.nationality;
  const positionMatch = guessed.position === target.position;

  const targetClubs = new Set(target.clubs.map((c) => c.toLowerCase()));
  const sharedClub =
    guessed.clubs.find((c) => targetClubs.has(c.toLowerCase())) ?? null;

  let birthYearComparison: 'exact' | 'higher' | 'lower' | 'unknown' = 'unknown';
  if (typeof guessed.birthYear === 'number') {
    if (target.birthYear > guessed.birthYear) {
      birthYearComparison = 'higher';
    } else if (target.birthYear < guessed.birthYear) {
      birthYearComparison = 'lower';
    } else {
      birthYearComparison = 'exact';
    }
  }

  return {
    guessedPlayer: guessed,
    isCorrect,
    nationalityMatch,
    positionMatch,
    sharedClub,
    birthYearComparison,
  };
}
