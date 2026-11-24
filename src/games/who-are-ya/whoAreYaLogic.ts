import { Player } from '../../types';

export const WHO_ARE_YA_MAX_ATTEMPTS = 6;

/**
 * Blur intensity (px / native blurRadius) by wrong-guess count.
 * Starts heavily blurred and progressively clears with each wrong guess.
 */
export const BLUR_LEVELS = [26, 20, 14, 9, 5, 2, 0] as const;

export interface WhoAreYaGuessFeedback {
  guessedPlayer: Player;
  isCorrect: boolean;
  nationalityMatch: boolean;
  positionMatch: boolean;
  sharedClub: string | null;
  birthYearComparison: 'exact' | 'higher' | 'lower';
}

export function getBlurAmount(wrongGuesses: number, revealed: boolean): number {
  if (revealed) return 0;
  const idx = Math.min(wrongGuesses, BLUR_LEVELS.length - 1);
  return BLUR_LEVELS[idx];
}

export function evaluateWhoAreYaGuess(
  guessed: Player,
  target: Player
): WhoAreYaGuessFeedback {
  const isCorrect = guessed.id === target.id;
  const nationalityMatch = guessed.nationality === target.nationality;
  const positionMatch = guessed.position === target.position;

  const targetClubs = new Set(target.clubs.map((c) => c.toLowerCase()));
  const sharedClub =
    guessed.clubs.find((c) => targetClubs.has(c.toLowerCase())) ?? null;

  let birthYearComparison: 'exact' | 'higher' | 'lower' = 'exact';
  if (target.birthYear > guessed.birthYear) {
    birthYearComparison = 'higher';
  } else if (target.birthYear < guessed.birthYear) {
    birthYearComparison = 'lower';
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
