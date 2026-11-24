import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Team, ThemePreference, ThemeTokens } from '../types';
import { getTeamById } from '../data/teamRepository';
import {
  getOnboardingDone,
  getSelectedTeamId,
  getThemePreference,
  setOnboardingDone,
  setSelectedTeamId,
  setThemePreference,
} from '../utils/storage';
import {
  ensureSurfaceContrast,
  hexWithAlpha,
  pickReadableTextColor,
} from '../utils/color';

const FOOTBALL_GREEN_LIGHT = '#1B6B3A';
const FOOTBALL_GREEN_DARK = '#259150';
const DEFAULT_ACCENT_LIGHT = '#0F766E';
const DEFAULT_ACCENT_DARK = '#2DD4BF';
const DEFAULT_SECONDARY_LIGHT = '#1E3A8A';
const DEFAULT_SECONDARY_DARK = '#60A5FA';

interface ThemeContextValue {
  tokens: ThemeTokens;
  selectedTeam: Team | null;
  themePreference: ThemePreference;
  onboardingDone: boolean;
  isHydrated: boolean;
  selectTeam: (teamId: string | null) => Promise<void>;
  completeOnboarding: (teamId: string | null) => Promise<void>;
  updateThemePreference: (pref: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildThemeTokens(isDark: boolean, team: Team | null): ThemeTokens {
  const background = isDark ? '#0D1117' : '#F4F6F8';
  const surface = isDark ? '#161B22' : '#FFFFFF';
  const surfaceElevated = isDark ? '#1F2630' : '#EEF2F6';
  const border = isDark ? '#2D3540' : '#DCE2E8';
  const text = isDark ? '#F3F4F6' : '#111827';
  const textMuted = isDark ? '#9CA3AF' : '#4B5563';

  const footballGreen = isDark ? FOOTBALL_GREEN_DARK : FOOTBALL_GREEN_LIGHT;
  const footballGreenText = pickReadableTextColor(footballGreen);

  const rawPrimary = team ? team.primaryColor : isDark ? DEFAULT_ACCENT_DARK : DEFAULT_ACCENT_LIGHT;
  const rawSecondary = team
    ? team.secondaryColor
    : isDark
      ? DEFAULT_SECONDARY_DARK
      : DEFAULT_SECONDARY_LIGHT;

  const accent = ensureSurfaceContrast(rawPrimary, surface, isDark);
  const accentText = pickReadableTextColor(accent);

  const accentSecondary = ensureSurfaceContrast(rawSecondary, surface, isDark);
  const accentSecondaryText = pickReadableTextColor(accentSecondary);

  const accentSoft = hexWithAlpha(accent, isDark ? 0.2 : 0.12);

  return {
    isDark,
    background,
    surface,
    surfaceElevated,
    border,
    text,
    textMuted,
    footballGreen,
    footballGreenText,
    accent,
    accentText,
    accentSecondary,
    accentSecondaryText,
    accentSoft,
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    neutralTile: isDark ? '#374151' : '#6B7280',
    neutralTileText: '#FFFFFF',
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [selectedTeamId, setTeamIdState] = useState<string | null>(null);
  const [themePreference, setThemePrefState] = useState<ThemePreference>('system');
  const [onboardingDone, setOnboardingDoneState] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [done, teamId, pref] = await Promise.all([
          getOnboardingDone(),
          getSelectedTeamId(),
          getThemePreference(),
        ]);
        if (!mounted) return;
        setOnboardingDoneState(done);
        setTeamIdState(teamId);
        setThemePrefState(pref);
      } finally {
        if (mounted) setIsHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedTeam = useMemo(() => getTeamById(selectedTeamId), [selectedTeamId]);

  const isDark =
    themePreference === 'dark' || (themePreference === 'system' && systemScheme === 'dark');

  const tokens = useMemo(() => buildThemeTokens(isDark, selectedTeam), [isDark, selectedTeam]);

  const selectTeam = async (teamId: string | null) => {
    setTeamIdState(teamId);
    await setSelectedTeamId(teamId);
  };

  const completeOnboarding = async (teamId: string | null) => {
    setTeamIdState(teamId);
    setOnboardingDoneState(true);
    await Promise.all([setSelectedTeamId(teamId), setOnboardingDone(true)]);
  };

  const updateThemePreference = async (pref: ThemePreference) => {
    setThemePrefState(pref);
    await setThemePreference(pref);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      tokens,
      selectedTeam,
      themePreference,
      onboardingDone,
      isHydrated,
      selectTeam,
      completeOnboarding,
      updateThemePreference,
    }),
    [tokens, selectedTeam, themePreference, onboardingDone, isHydrated]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
