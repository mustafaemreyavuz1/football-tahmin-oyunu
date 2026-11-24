export type GameId = 'tenaball' | 'who-are-ya' | 'wordle';
export type GameMode = 'daily' | 'unlimited';
export type ThemePreference = 'system' | 'light' | 'dark';
export type Difficulty = 'kolay' | 'orta' | 'zor';

export interface Team {
  id: string;
  name: string;
  league: string;
  country: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface Player {
  id: string;
  name: string;
  surname: string;
  nationality: string;
  position: string;
  clubs: string[];
  birthYear: number;
  imageFile: string;
  imageLicense: string;
  imageAttribution: string;
}

export interface TenaBallQuestion {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  answers: string[];
  sourceUrl: string;
  asOf: string;
  verified: boolean;
}

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  bestStreak: number;
  /** Key: attempt number ('1'..'6') or score bucket ('0'..'10' for TenaBall) */
  distribution: Record<string, number>;
  lastPlayedDate?: string;
}

export interface DailyCompletionRecord {
  dateKey: string;
  puzzleId: string;
  won: boolean;
  scoreText: string;
  shareText: string;
  completedAt: string;
}

export interface RemoteSyncStatus {
  source: 'remote' | 'cache' | 'bundled';
  questionCount: number;
  lastUpdatedAt?: string;
  error?: string;
}

export interface ThemeTokens {
  isDark: boolean;
  // Fixed base colors (neutral background, football-green primary)
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  footballGreen: string;
  footballGreenText: string;
  // Team-driven secondary / accent colors (contrast-verified)
  accent: string;
  accentText: string;
  accentSecondary: string;
  accentSecondaryText: string;
  accentSoft: string;
  // Semantic feedback colors
  success: string;
  warning: string;
  danger: string;
  neutralTile: string;
  neutralTileText: string;
}
