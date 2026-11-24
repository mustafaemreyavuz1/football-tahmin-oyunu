import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { WordleCellStatus } from '../../utils/share';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

interface WordleKeyboardProps {
  keyStates: Record<string, WordleCellStatus>;
  onKeyPress: (key: string) => void;
  disabled?: boolean;
}

export function WordleKeyboard({
  keyStates,
  onKeyPress,
  disabled = false,
}: WordleKeyboardProps) {
  const { tokens } = useTheme();

  return (
    <View style={styles.wrapper}>
      {ROWS.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {row.map((key) => {
            const isAction = key === 'ENTER' || key === 'BACK';
            const status = keyStates[key];

            let bg = tokens.surfaceElevated;
            let textColor = tokens.text;

            if (key === 'ENTER') {
              bg = tokens.accent;
              textColor = tokens.accentText;
            } else if (status === 'correct') {
              bg = tokens.success;
              textColor = '#FFFFFF';
            } else if (status === 'present') {
              bg = tokens.warning;
              textColor = '#FFFFFF';
            } else if (status === 'absent') {
              bg = tokens.neutralTile;
              textColor = tokens.neutralTileText;
            }

            return (
              <Pressable
                key={key}
                onPress={() => !disabled && onKeyPress(key)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.key,
                  isAction && styles.actionKey,
                  {
                    backgroundColor: bg,
                    opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
                  },
                ]}
              >
                {key === 'BACK' ? (
                  <Ionicons name="backspace-outline" size={18} color={textColor} />
                ) : (
                  <Text
                    style={[
                      styles.keyText,
                      isAction && styles.actionText,
                      { color: textColor },
                    ]}
                  >
                    {key === 'ENTER' ? 'GİR' : key}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    gap: 6,
    paddingTop: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  key: {
    flex: 1,
    minWidth: 26,
    maxWidth: 44,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionKey: {
    flex: 1.55,
    maxWidth: 66,
  },
  keyText: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
