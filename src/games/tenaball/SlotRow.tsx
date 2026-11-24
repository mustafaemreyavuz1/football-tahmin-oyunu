import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface SlotRowProps {
  rank: number;
  answer: string;
  solved: boolean;
  revealedAtEnd: boolean;
  highlighted?: boolean;
  reduceMotion?: boolean;
}

export function SlotRow({
  rank,
  answer,
  solved,
  revealedAtEnd,
  highlighted = false,
  reduceMotion = false,
}: SlotRowProps) {
  const { tokens } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const prevSolvedRef = useRef(solved);

  useEffect(() => {
    const newlySolved = solved && !prevSolvedRef.current;
    prevSolvedRef.current = solved;

    if (newlySolved && !reduceMotion) {
      scaleAnim.setValue(0.88);
      opacityAnim.setValue(0.35);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 130,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [solved, reduceMotion, scaleAnim, opacityAnim]);

  const showAnswer = solved || revealedAtEnd;

  const backgroundColor = highlighted
    ? tokens.accent
    : solved
      ? tokens.accentSoft
      : revealedAtEnd
        ? tokens.surfaceElevated
        : tokens.surface;

  const borderColor = highlighted
    ? tokens.accentSecondary
    : solved
      ? tokens.accent
      : tokens.border;

  const textColor = highlighted
    ? tokens.accentText
    : solved
      ? tokens.text
      : tokens.textMuted;

  return (
    <Animated.View
      style={[
        styles.row,
        {
          transform: [{ scale: highlighted && !reduceMotion ? 1.02 : scaleAnim }],
          opacity: opacityAnim,
          backgroundColor,
          borderColor,
          borderWidth: highlighted ? 2 : 1.2,
        },
      ]}
    >
      <View
        style={[
          styles.rankBadge,
          {
            backgroundColor: highlighted
              ? tokens.accentSecondary
              : solved
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
              color: highlighted
                ? tokens.accentSecondaryText
                : solved
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
            color: textColor,
            fontWeight: solved || highlighted ? '800' : revealedAtEnd ? '600' : '500',
          },
        ]}
        numberOfLines={1}
      >
        {showAnswer ? answer : '••••••••••••'}
      </Text>

      {solved ? (
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={highlighted ? tokens.accentText : tokens.success}
        />
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
