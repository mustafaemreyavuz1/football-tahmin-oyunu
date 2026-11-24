/**
 * WCAG 2.1 color contrast & accessibility utilities.
 * Ensures every club's primary/secondary colors remain legible in both Light & Dark themes.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Relative luminance per WCAG 2.1 specification.
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * WCAG contrast ratio between two hex colors (1..21).
 */
export function getContrastRatio(hexA: string, hexB: string): number {
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Auto-picks accessible light or dark foreground text color for any background hex.
 */
export function pickReadableTextColor(backgroundHex: string): '#FFFFFF' | '#111827' {
  const whiteContrast = getContrastRatio(backgroundHex, '#FFFFFF');
  const darkContrast = getContrastRatio(backgroundHex, '#111827');
  return whiteContrast >= darkContrast ? '#FFFFFF' : '#111827';
}

/**
 * Blends hexA toward hexB by factor t (0..1).
 */
export function mixHex(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

/**
 * Adjusts a team accent color so it has sufficient contrast against the surface background
 * (e.g., pure black club color on dark mode gets lifted; pure white on light mode gets darkened).
 */
export function ensureSurfaceContrast(accentHex: string, surfaceHex: string, isDark: boolean): string {
  const minRatio = 3.0;
  if (getContrastRatio(accentHex, surfaceHex) >= minRatio) {
    return accentHex;
  }
  const target = isDark ? '#F3F4F6' : '#111827';
  let candidate = accentHex;
  for (let step = 1; step <= 10; step += 1) {
    candidate = mixHex(accentHex, target, step * 0.09);
    if (getContrastRatio(candidate, surfaceHex) >= minRatio) {
      return candidate;
    }
  }
  return candidate;
}

/**
 * Produces a soft tinted background from a hex color with given alpha (rgba string).
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
