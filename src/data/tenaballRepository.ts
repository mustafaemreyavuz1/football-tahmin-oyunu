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

export function getTenaBallQuestions(): TenaBallQuestion[] {
  return activeQuestions;
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

export function getDailyTenaBallQuestion(date: Date = new Date()): TenaBallQuestion {
  const idx = getDailyPuzzleIndex('tenaball', activeQuestions.length, date);
  return activeQuestions[idx];
}

export function getRandomTenaBallQuestion(excludeId?: string): TenaBallQuestion {
  const pool = excludeId
    ? activeQuestions.filter((q) => q.id !== excludeId)
    : activeQuestions;
  return pool[Math.floor(Math.random() * pool.length)];
}
