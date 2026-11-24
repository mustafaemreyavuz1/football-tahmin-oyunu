import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

interface AppContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function AppContainer({ children, style }: AppContainerProps) {
  const { tokens } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.background }]} edges={['top', 'bottom']}>
      <View style={[styles.inner, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
