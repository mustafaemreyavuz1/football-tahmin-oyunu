import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { WordleCellStatus } from '../../utils/share';
import { WORDLE_MAX_ATTEMPTS } from './wordleLogic';

interface WordleGridProps {
  wordLength: number;
  guesses: string[];
  evaluations: WordleCellStatus[][];
  currentGuess: string;
}

export function WordleGrid({
  wordLength,
  guesses,
  evaluations,
  currentGuess,
}: WordleGridProps) {
  const { width } = useWindowDimensions();
  const containerWidth = Math.min(width - 32, 520);
  const gap = wordLength >= 10 ? 4 : 6;
  const rawTileSize = Math.floor((containerWidth - gap * (wordLength - 1)) / wordLength);
  const tileSize = Math.max(24, Math.min(52, rawTileSize));
  const fontSize = Math.max(13, Math.min(24, Math.floor(tileSize * 0.48)));

  return (
    <View style={[styles.grid, { gap }]}>
      {Array.from({ length: WORDLE_MAX_ATTEMPTS }).map((_, rowIdx) => {
        const isSubmitted = rowIdx < guesses.length;
        const isCurrent = rowIdx === guesses.length;
        const rowWord = isSubmitted
          ? guesses[rowIdx]
          : isCurrent
            ? currentGuess
            : '';
        const evalRow = isSubmitted ? evaluations[rowIdx] : undefined;

        return (
          <View key={rowIdx} style={[styles.row, { gap }]}>
            {Array.from({ length: wordLength }).map((__, colIdx) => (
              <WordleTile
                key={colIdx}
                letter={rowWord[colIdx] ?? ''}
                status={evalRow ? evalRow[colIdx] : undefined}
                size={tileSize}
                fontSize={fontSize}
                delayMs={colIdx * 75}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

interface WordleTileProps {
  letter: string;
  status?: WordleCellStatus;
  size: number;
  fontSize: number;
  delayMs: number;
}

function WordleTile({ letter, status, size, fontSize, delayMs }: WordleTileProps) {
  const { tokens } = useTheme();
  const flipAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status) {
      flipAnim.setValue(0.15);
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.spring(flipAnim, {
          toValue: 1,
          friction: 6,
          tension: 110,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [status, delayMs, flipAnim]);

  let bg = tokens.surface;
  let borderColor = letter ? tokens.accent : tokens.border;
  let textColor = tokens.text;

  if (status === 'correct') {
    bg = tokens.success;
    borderColor = tokens.success;
    textColor = '#FFFFFF';
  } else if (status === 'present') {
    bg = tokens.warning;
    borderColor = tokens.warning;
    textColor = '#FFFFFF';
  } else if (status === 'absent') {
    bg = tokens.neutralTile;
    borderColor = tokens.neutralTile;
    textColor = tokens.neutralTileText;
  }

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderColor,
          transform: [{ scaleY: flipAnim }],
        },
      ]}
    >
      <Text style={[styles.letter, { fontSize, color: textColor }]}>{letter}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tile: {
    borderRadius: 8,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontWeight: '900',
  },
});
