import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { GameMode } from '../types';

export type WordleCellStatus = 'correct' | 'present' | 'absent';

export function buildWordleShareText(
  mode: GameMode,
  dateKey: string,
  evaluations: WordleCellStatus[][],
  won: boolean,
  maxAttempts: number
): string {
  const header =
    mode === 'daily'
      ? `⚽ Football Wordle (${dateKey}) ${won ? evaluations.length : 'X'}/${maxAttempts}`
      : `⚽ Football Wordle (Sınırsız) ${won ? evaluations.length : 'X'}/${maxAttempts}`;
  const grid = evaluations
    .map((row) =>
      row
        .map((cell) => {
          if (cell === 'correct') return '🟩';
          if (cell === 'present') return '🟨';
          return '⬜';
        })
        .join('')
    )
    .join('\n');
  return `${header}\n\n${grid}\n\nFootball Tahmin Oyunu`;
}

export function buildTenaBallShareText(
  mode: GameMode,
  dateKey: string,
  title: string,
  solvedFlags: boolean[],
  livesLeft: number,
  maxLives: number
): string {
  const foundCount = solvedFlags.filter(Boolean).length;
  const header =
    mode === 'daily'
      ? `⚽ TenaBall (${dateKey}) ${foundCount}/10`
      : `⚽ TenaBall (Sınırsız) ${foundCount}/10`;
  const row1 = solvedFlags
    .slice(0, 5)
    .map((s) => (s ? '🟩' : '⬛'))
    .join('');
  const row2 = solvedFlags
    .slice(5, 10)
    .map((s) => (s ? '🟩' : '⬛'))
    .join('');
  const hearts = '❤️'.repeat(livesLeft) + '🖤'.repeat(Math.max(0, maxLives - livesLeft));
  return `${header}\n"${title}"\n\n${row1}\n${row2}\nCan: ${hearts}\n\nFootball Tahmin Oyunu`;
}

export function buildWhoAreYaShareText(
  mode: GameMode,
  dateKey: string,
  attemptResults: boolean[],
  won: boolean,
  maxAttempts: number
): string {
  const header =
    mode === 'daily'
      ? `⚽ Who Are Ya (${dateKey}) ${won ? attemptResults.length : 'X'}/${maxAttempts}`
      : `⚽ Who Are Ya (Sınırsız) ${won ? attemptResults.length : 'X'}/${maxAttempts}`;
  const blocks = attemptResults.map((ok) => (ok ? '🟩' : '🟥')).join('');
  return `${header}\n\n${blocks}\n\nFootball Tahmin Oyunu`;
}

/**
 * Shares result text via native Share sheet on iOS/Android, or copies to clipboard on Web.
 * Returns a Turkish feedback message.
 */
export async function shareResultText(text: string): Promise<string> {
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(text);
    return 'Sonuç panoya kopyalandı!';
  }
  try {
    await Share.share({ message: text });
    return 'Paylaşım penceresi açıldı!';
  } catch {
    await Clipboard.setStringAsync(text);
    return 'Sonuç panoya kopyalandı!';
  }
}
