import { findBestTenaBallMatch } from '../../utils/matching';

export const TENABALL_MAX_LIVES = 5;

export interface TenaBallState {
  solvedIndices: number[];
  livesLeft: number;
  wrongGuesses: string[];
  status: 'playing' | 'won' | 'lost';
}

export function createInitialTenaBallState(): TenaBallState {
  return {
    solvedIndices: [],
    livesLeft: TENABALL_MAX_LIVES,
    wrongGuesses: [],
    status: 'playing',
  };
}

export type TenaBallGuessOutcome =
  | { type: 'correct'; slotIndex: number; answer: string; nextState: TenaBallState }
  | { type: 'duplicate'; nextState: TenaBallState }
  | { type: 'wrong'; nextState: TenaBallState }
  | { type: 'ignored'; nextState: TenaBallState };

export function submitTenaBallGuess(
  state: TenaBallState,
  guess: string,
  answers: string[]
): TenaBallGuessOutcome {
  if (state.status !== 'playing') {
    return { type: 'ignored', nextState: state };
  }
  const trimmed = guess.trim();
  if (trimmed.length < 2) {
    return { type: 'ignored', nextState: state };
  }

  const solvedSet = new Set(state.solvedIndices);
  const { index, alreadySolved } = findBestTenaBallMatch(trimmed, answers, solvedSet);

  if (alreadySolved) {
    return { type: 'duplicate', nextState: state };
  }

  if (index !== -1) {
    const nextSolved = [...state.solvedIndices, index];
    const won = nextSolved.length >= answers.length;
    const nextState: TenaBallState = {
      ...state,
      solvedIndices: nextSolved,
      status: won ? 'won' : 'playing',
    };
    return { type: 'correct', slotIndex: index, answer: answers[index], nextState };
  }

  const nextLives = Math.max(0, state.livesLeft - 1);
  const lost = nextLives === 0;
  const nextState: TenaBallState = {
    ...state,
    livesLeft: nextLives,
    wrongGuesses: [...state.wrongGuesses, trimmed],
    status: lost ? 'lost' : 'playing',
  };
  return { type: 'wrong', nextState };
}
