import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DailyCompletionRecord,
  GameId,
  GameStats,
  TenaBallErrorReport,
  TenaBallQuestion,
  ThemePreference,
} from '../types';

const KEYS = {
  ONBOARDING_DONE: '@fto/onboarding_done',
  SELECTED_TEAM_ID: '@fto/selected_team_id',
  THEME_PREFERENCE: '@fto/theme_preference',
  STATS_PREFIX: '@fto/stats/',
  DAILY_PREFIX: '@fto/daily/',
  REMOTE_TENABALL_CACHE: '@fto/remote_tenaball_cache',
  REMOTE_TENABALL_UPDATED_AT: '@fto/remote_tenaball_updated_at',
  ALLOW_UNVERIFIED_TENABALL: '@fto/allow_unverified_tenaball',
  TENABALL_ERROR_REPORTS: '@fto/tenaball_error_reports',
};

export function createEmptyStats(): GameStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: {},
  };
}

export async function getOnboardingDone(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.ONBOARDING_DONE);
  return val === 'true';
}

export async function setOnboardingDone(done: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.ONBOARDING_DONE, done ? 'true' : 'false');
}

export async function getSelectedTeamId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.SELECTED_TEAM_ID);
}

export async function setSelectedTeamId(teamId: string | null): Promise<void> {
  if (teamId === null) {
    await AsyncStorage.removeItem(KEYS.SELECTED_TEAM_ID);
  } else {
    await AsyncStorage.setItem(KEYS.SELECTED_TEAM_ID, teamId);
  }
}

export async function getThemePreference(): Promise<ThemePreference> {
  const val = await AsyncStorage.getItem(KEYS.THEME_PREFERENCE);
  if (val === 'light' || val === 'dark' || val === 'system') return val;
  return 'system';
}

export async function setThemePreference(pref: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(KEYS.THEME_PREFERENCE, pref);
}

export async function getGameStats(gameId: GameId): Promise<GameStats> {
  const raw = await AsyncStorage.getItem(`${KEYS.STATS_PREFIX}${gameId}`);
  if (!raw) return createEmptyStats();
  try {
    const parsed = JSON.parse(raw) as Partial<GameStats>;
    return {
      gamesPlayed: parsed.gamesPlayed ?? 0,
      gamesWon: parsed.gamesWon ?? 0,
      currentStreak: parsed.currentStreak ?? 0,
      bestStreak: parsed.bestStreak ?? 0,
      distribution: parsed.distribution ?? {},
      lastPlayedDate: parsed.lastPlayedDate,
    };
  } catch {
    return createEmptyStats();
  }
}

export async function recordGameResult(
  gameId: GameId,
  won: boolean,
  distributionKey: string,
  dateKey?: string
): Promise<GameStats> {
  const stats = await getGameStats(gameId);
  stats.gamesPlayed += 1;
  if (won) {
    stats.gamesWon += 1;
    stats.currentStreak += 1;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
  } else {
    stats.currentStreak = 0;
  }
  stats.distribution[distributionKey] = (stats.distribution[distributionKey] ?? 0) + 1;
  if (dateKey) {
    stats.lastPlayedDate = dateKey;
  }
  await AsyncStorage.setItem(`${KEYS.STATS_PREFIX}${gameId}`, JSON.stringify(stats));
  return stats;
}

export async function getDailyCompletion(
  gameId: GameId,
  dateKey: string
): Promise<DailyCompletionRecord | null> {
  const raw = await AsyncStorage.getItem(`${KEYS.DAILY_PREFIX}${gameId}/${dateKey}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DailyCompletionRecord;
  } catch {
    return null;
  }
}

export async function saveDailyCompletion(
  gameId: GameId,
  record: DailyCompletionRecord
): Promise<void> {
  await AsyncStorage.setItem(
    `${KEYS.DAILY_PREFIX}${gameId}/${record.dateKey}`,
    JSON.stringify(record)
  );
}

export async function getCachedRemoteTenaBall(): Promise<{
  questions: TenaBallQuestion[];
  updatedAt?: string;
} | null> {
  const raw = await AsyncStorage.getItem(KEYS.REMOTE_TENABALL_CACHE);
  if (!raw) return null;
  try {
    const questions = JSON.parse(raw) as TenaBallQuestion[];
    const updatedAt = (await AsyncStorage.getItem(KEYS.REMOTE_TENABALL_UPDATED_AT)) ?? undefined;
    return { questions, updatedAt };
  } catch {
    return null;
  }
}

export async function saveCachedRemoteTenaBall(questions: TenaBallQuestion[]): Promise<string> {
  const now = new Date().toISOString();
  await AsyncStorage.setItem(KEYS.REMOTE_TENABALL_CACHE, JSON.stringify(questions));
  await AsyncStorage.setItem(KEYS.REMOTE_TENABALL_UPDATED_AT, now);
  return now;
}

export async function getAllowUnverifiedTenaBall(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.ALLOW_UNVERIFIED_TENABALL);
  return val === 'true';
}

export async function setAllowUnverifiedTenaBall(allow: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.ALLOW_UNVERIFIED_TENABALL, allow ? 'true' : 'false');
}

export async function getTenaBallErrorReports(): Promise<TenaBallErrorReport[]> {
  const raw = await AsyncStorage.getItem(KEYS.TENABALL_ERROR_REPORTS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TenaBallErrorReport[]) : [];
  } catch {
    return [];
  }
}

export async function addTenaBallErrorReport(entry: {
  id: string;
  title: string;
}): Promise<TenaBallErrorReport[]> {
  const current = await getTenaBallErrorReports();
  if (current.some((item) => item.id === entry.id)) {
    return current;
  }
  const next: TenaBallErrorReport[] = [
    { id: entry.id, title: entry.title, reportedAt: new Date().toISOString() },
    ...current,
  ];
  await AsyncStorage.setItem(KEYS.TENABALL_ERROR_REPORTS, JSON.stringify(next));
  return next;
}

export async function clearTenaBallErrorReports(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.TENABALL_ERROR_REPORTS);
}
