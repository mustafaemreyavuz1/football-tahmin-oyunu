import bundledData from './tenaball.json';
import { RemoteSyncStatus, TenaBallQuestion } from '../types';
import { getDailyPuzzleIndex } from '../utils/daily';
import { syncRemoteTenaBallQuestions } from './remoteSync';

const BUNDLED_QUESTIONS: TenaBallQuestion[] = bundledData as TenaBallQuestion[];

let activeQuestions: TenaBallQuestion[] = BUNDLED_QUESTIONS;
let syncStatus: RemoteSyncStatus = {
  source: 'bundled',
  questionCount: BUNDLED_QUESTIONS.length,
};

export function getAllTenaBallQuestions(): TenaBallQuestion[] {
  return activeQuestions;
}

/**
 * Only returns TenaBall lists that are verified (verified === true) and not hidden.
 */
export function getPlayableTenaBallQuestions(): TenaBallQuestion[] {
  return activeQuestions.filter((q) => q.verified === true && !q.hidden);
}

export function getTenaBallCounts() {
  const total = activeQuestions.length;
  const hidden = activeQuestions.filter((q) => q.hidden === true).length;
  const verifiedPlayable = activeQuestions.filter((q) => q.verified === true && !q.hidden).length;
  return {
    total,
    hidden,
    visible: total - hidden,
    verifiedPlayable,
  };
}

export function getTenaBallSyncStatus(): RemoteSyncStatus {
  return syncStatus;
}

export async function refreshTenaBallQuestions(): Promise<RemoteSyncStatus> {
  const result = await syncRemoteTenaBallQuestions(BUNDLED_QUESTIONS);
  activeQuestions = result.questions;
  syncStatus = result.status;
  return syncStatus;
}

export function getDailyTenaBallQuestion(date: Date = new Date()): TenaBallQuestion | null {
  const playable = getPlayableTenaBallQuestions();
  if (playable.length === 0) return null;
  const idx = getDailyPuzzleIndex('tenaball', playable.length, date);
  return playable[idx];
}

export function getRandomTenaBallQuestion(excludeId?: string): TenaBallQuestion | null {
  const playable = getPlayableTenaBallQuestions();
  if (playable.length === 0) return null;
  const pool = excludeId && playable.length > 1
    ? playable.filter((q) => q.id !== excludeId)
    : playable;
  return pool[Math.floor(Math.random() * pool.length)];
}
