import React from 'react';
import { StyleSheet, View } from 'react-native';

interface TeamColorDotProps {
  primaryColor: string;
  secondaryColor: string;
  size?: number;
}

/**
 * Displays a club's primary & secondary colors as a split circle swatch.
 * No club logos or crests are used anywhere in the app.
 */
export function TeamColorDot({ primaryColor, secondaryColor, size = 28 }: TeamColorDotProps) {
  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: 'rgba(128,128,128,0.35)',
        },
      ]}
    >
      <View style={[styles.half, { backgroundColor: primaryColor }]} />
      <View style={[styles.half, { backgroundColor: secondaryColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
  },
  half: {
    flex: 1,
    height: '100%',
  },
});
