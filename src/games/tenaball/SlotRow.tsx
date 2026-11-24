import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

interface SlotRowProps {
  rank: number;
  answer: string;
  solved: boolean;
  revealedAtEnd: boolean;
}

export function SlotRow({ rank, answer, solved, revealedAtEnd }: SlotRowProps) {
  const { tokens } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (solved) {
      scaleAnim.setValue(0.92);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [solved, scaleAnim]);

  const showAnswer = solved || revealedAtEnd;

  return (
    <Animated.View
      style={[
        styles.row,
        {
          transform: [{ scale: scaleAnim }],
          backgroundColor: solved
            ? tokens.accentSoft
            : revealedAtEnd
              ? tokens.surfaceElevated
              : tokens.surface,
          borderColor: solved ? tokens.accent : tokens.border,
        },
      ]}
    >
      <View
        style={[
          styles.rankBadge,
          {
            backgroundColor: solved
              ? tokens.accent
              : revealedAtEnd
                ? tokens.neutralTile
                : tokens.surfaceElevated,
          },
        ]}
      >
        <Text
          style={[
            styles.rankText,
            {
              color: solved
                ? tokens.accentText
                : revealedAtEnd
                  ? tokens.neutralTileText
                  : tokens.textMuted,
            },
          ]}
        >
          {rank}
        </Text>
      </View>

      <Text
        style={[
          styles.answerText,
          {
            color: solved
              ? tokens.text
              : revealedAtEnd
                ? tokens.textMuted
                : tokens.textMuted,
            fontWeight: solved ? '800' : revealedAtEnd ? '600' : '500',
          },
        ]}
        numberOfLines={1}
      >
        {showAnswer ? answer : '••••••••••••'}
      </Text>

      {solved ? (
        <Ionicons name="checkmark-circle" size={20} color={tokens.success} />
      ) : revealedAtEnd ? (
        <Ionicons name="close-circle-outline" size={20} color={tokens.danger} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1.2,
    gap: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '800',
  },
  answerText: {
    flex: 1,
    fontSize: 15,
  },
});
