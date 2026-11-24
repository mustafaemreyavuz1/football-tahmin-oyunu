/**
 * Accent-insensitive, Turkish-aware normalization helpers.
 * Handles Turkish dotted/dotless I (İ/ı), ğ, ş, ç, ö, ü and European diacritics
 * (é, á, ñ, ø, đ, ł, ž, ć, š, ß, etc.).
 */

const CHAR_REPLACEMENTS: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  I: 'i',
  ğ: 'g',
  Ğ: 'g',
  ş: 's',
  Ş: 's',
  ç: 'c',
  Ç: 'c',
  ö: 'o',
  Ö: 'o',
  ü: 'u',
  Ü: 'u',
  ø: 'o',
  Ø: 'o',
  đ: 'd',
  Đ: 'd',
  ł: 'l',
  Ł: 'l',
  ß: 'ss',
  æ: 'ae',
  Æ: 'ae',
  œ: 'oe',
  Œ: 'oe',
};

/**
 * Normalizes a string to lowercase ASCII letters/digits with single spaces.
 * Used for fuzzy name matching, search, and TenaBall answer comparison.
 */
export function normalizeText(input: string): string {
  if (!input) return '';
  let replaced = '';
  for (const ch of input) {
    replaced += CHAR_REPLACEMENTS[ch] ?? ch;
  }
  return replaced
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`´.-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a player's surname for Football Wordle:
 * - Converts Turkish & European special letters to ASCII A-Z
 * - Removes spaces, hyphens, and apostrophes consistently so multi-word surnames
 *   like "De Bruyne" -> "DEBRUYNE" and "Eto'o" -> "ETOO" work cleanly on the grid.
 */
export function normalizeForWordle(surname: string): string {
  return normalizeText(surname).replace(/[^a-z]/g, '').toUpperCase();
}

/**
 * Extracts probable surname tokens from a full player name automatically
 * (no hand-written aliases). Handles multi-word particles like "de", "van",
 * "del", "di", "da", "dos", "el", "ter", "mac", "al".
 */
const SURNAME_PARTICLES = new Set([
  'de',
  'del',
  'di',
  'da',
  'dos',
  'das',
  'van',
  'von',
  'der',
  'den',
  'ter',
  'el',
  'al',
  'mac',
  'mc',
  'la',
  'le',
  'st',
  'san',
]);

export function extractSurnameFromFullName(fullName: string): string {
  const normalized = normalizeText(fullName);
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length <= 1) return normalized;

  // Walk backwards from last token and include preceding surname particles
  const surnameTokens = [tokens[tokens.length - 1]];
  let i = tokens.length - 2;
  while (i >= 1 && SURNAME_PARTICLES.has(tokens[i])) {
    surnameTokens.unshift(tokens[i]);
    i -= 1;
  }
  return surnameTokens.join(' ');
}
