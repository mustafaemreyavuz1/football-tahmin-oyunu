import playersData from './players.json';
import { Player } from '../types';
import { normalizeForWordle, normalizeText } from '../utils/normalization';
import { getDailyPuzzleIndex } from '../utils/daily';

const ALL_PLAYERS: Player[] = playersData as Player[];

/**
 * Pool for Who Are Ya: all players with a valid imageFile & attribution.
 */
const WHO_ARE_YA_POOL: Player[] = ALL_PLAYERS.filter(
  (p) => Boolean(p.imageFile && p.imageLicense && p.imageAttribution)
);

/**
 * Pool for Football Wordle: all players whose normalized surname is between 3 and 14 letters.
 */
const WORDLE_POOL: Player[] = ALL_PLAYERS.filter((p) => {
  const norm = normalizeForWordle(p.surname);
  return norm.length >= 3 && norm.length <= 14;
});

export function getAllPlayers(): Player[] {
  return ALL_PLAYERS;
}

export function getWhoAreYaPool(): Player[] {
  return WHO_ARE_YA_POOL;
}

export function getWordlePool(): Player[] {
  return WORDLE_POOL;
}

export function getPlayerById(id: string): Player | undefined {
  return ALL_PLAYERS.find((p) => p.id === id);
}

/**
 * Builds a Wikimedia Commons thumbnail URL via Special:FilePath.
 */
export function getWikimediaImageUrl(imageFile: string, width: number = 480): string {
  if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
    return imageFile;
  }
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}?width=${width}`;
}

/**
 * Accent-insensitive autocomplete search over the shared player pool.
 */
export function searchPlayers(query: string, limit: number = 8): Player[] {
  const norm = normalizeText(query);
  if (norm.length < 1) return [];

  const scored: { player: Player; rank: number }[] = [];
  for (const player of ALL_PLAYERS) {
    const normName = normalizeText(player.name);
    const normSurname = normalizeText(player.surname);
    if (normName.startsWith(norm) || normSurname.startsWith(norm)) {
      scored.push({ player, rank: 0 });
    } else if (normName.includes(norm) || normSurname.includes(norm)) {
      scored.push({ player, rank: 1 });
    }
  }

  scored.sort((a, b) => a.rank - b.rank || a.player.name.localeCompare(b.player.name, 'tr'));
  return scored.slice(0, limit).map((s) => s.player);
}

export function getDailyWhoAreYaPlayer(date: Date = new Date()): Player {
  const idx = getDailyPuzzleIndex('who-are-ya', WHO_ARE_YA_POOL.length, date);
  return WHO_ARE_YA_POOL[idx];
}

export function getRandomWhoAreYaPlayer(excludeId?: string): Player {
  const candidates = excludeId
    ? WHO_ARE_YA_POOL.filter((p) => p.id !== excludeId)
    : WHO_ARE_YA_POOL;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getDailyWordlePlayer(date: Date = new Date()): Player {
  const idx = getDailyPuzzleIndex('wordle', WORDLE_POOL.length, date);
  return WORDLE_POOL[idx];
}

export function getRandomWordlePlayer(excludeId?: string): Player {
  const candidates = excludeId
    ? WORDLE_POOL.filter((p) => p.id !== excludeId)
    : WORDLE_POOL;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
