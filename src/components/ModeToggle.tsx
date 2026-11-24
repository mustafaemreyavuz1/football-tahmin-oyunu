import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GameMode } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { getTimeUntilMidnight } from '../utils/daily';

interface ModeToggleProps {
  mode: GameMode;
  onChangeMode: (mode: GameMode) => void;
  dailyCompleted?: boolean;
}

export function ModeToggle({ mode, onChangeMode, dailyCompleted = false }: ModeToggleProps) {
  const { tokens } = useTheme();
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());

  useEffect(() => {
    if (!dailyCompleted) return;
    const id = setInterval(() => {
      setCountdown(getTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(id);
  }, [dailyCompleted]);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.segmented,
          { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border },
        ]}
      >
        <Pressable
          onPress={() => onChangeMode('daily')}
          style={[
            styles.tab,
            mode === 'daily' && { backgroundColor: tokens.accent },
          ]}
        >
          <Ionicons
            name={dailyCompleted ? 'checkmark-circle' : 'calendar'}
            size={15}
            color={mode === 'daily' ? tokens.accentText : tokens.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              { color: mode === 'daily' ? tokens.accentText : tokens.textMuted },
            ]}
          >
            Günlük Mod
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onChangeMode('unlimited')}
          style={[
            styles.tab,
            mode === 'unlimited' && { backgroundColor: tokens.accent },
          ]}
        >
          <Ionicons
            name="infinite"
            size={16}
            color={mode === 'unlimited' ? tokens.accentText : tokens.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              { color: mode === 'unlimited' ? tokens.accentText : tokens.textMuted },
            ]}
          >
            Sınırsız Mod
          </Text>
        </Pressable>
      </View>

      {mode === 'daily' && dailyCompleted && (
        <View style={[styles.lockBanner, { backgroundColor: tokens.accentSoft, borderColor: tokens.accent }]}>
          <Ionicons name="time-outline" size={16} color={tokens.accent} />
          <Text style={[styles.lockText, { color: tokens.text }]}>
            Bugünkü bulmaca tamamlandı! Yeni bulmaca:{' '}
            <Text style={{ fontWeight: '800', color: tokens.accent }}>{countdown}</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  lockText: {
    fontSize: 12.5,
    flex: 1,
  },
});
