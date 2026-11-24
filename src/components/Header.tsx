import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightActions?: React.ReactNode;
}

export function Header({ title, subtitle, showBack = true, rightActions }: HeaderProps) {
  const { tokens } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.wrapper, { backgroundColor: tokens.surface, borderBottomColor: tokens.border }]}>
      <View style={[styles.accentStrip, { backgroundColor: tokens.accent }]} />
      <View style={styles.row}>
        <View style={styles.left}>
          {showBack && (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: tokens.surfaceElevated, opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityLabel="Geri dön"
            >
              <Ionicons name="arrow-back" size={20} color={tokens.text} />
            </Pressable>
          )}
          <View style={styles.titleBox}>
            <Text style={[styles.title, { color: tokens.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: tokens.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {rightActions ? <View style={styles.right}>{rightActions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
  },
  accentStrip: {
    height: 3,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  titleBox: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
