import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GameStats } from '../types';
import { useTheme } from '../theme/ThemeContext';

interface StatsModalProps {
  visible: boolean;
  onClose: () => void;
  gameTitle: string;
  stats: GameStats;
  distributionLabels: string[];
  distributionHeading?: string;
}

export function StatsModal({
  visible,
  onClose,
  gameTitle,
  stats,
  distributionLabels,
  distributionHeading = 'Tahmin Dağılımı',
}: StatsModalProps) {
  const { tokens } = useTheme();
  const winRate =
    stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  const maxCount = Math.max(
    1,
    ...distributionLabels.map((k) => stats.distribution[k] ?? 0)
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: tokens.text }]}>{gameTitle} İstatistikleri</Text>
            <Pressable onPress={onClose} accessibilityLabel="Kapat">
              <Ionicons name="close" size={22} color={tokens.textMuted} />
            </Pressable>
          </View>

          <View style={styles.grid}>
            <StatBox label="Oynanan" value={String(stats.gamesPlayed)} />
            <StatBox label="Kazanma" value={`%${winRate}`} />
            <StatBox label="Mevcut Seri" value={String(stats.currentStreak)} />
            <StatBox label="En İyi Seri" value={String(stats.bestStreak)} />
          </View>

          <Text style={[styles.sectionTitle, { color: tokens.text }]}>{distributionHeading}</Text>

          <ScrollView style={styles.barsContainer}>
            {distributionLabels.map((key) => {
              const count = stats.distribution[key] ?? 0;
              const widthPct = Math.max(10, Math.round((count / maxCount) * 100));
              return (
                <View key={key} style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: tokens.textMuted }]}>{key}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${count === 0 ? 10 : widthPct}%`,
                          backgroundColor: count > 0 ? tokens.accent : tokens.surfaceElevated,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.barCount,
                          { color: count > 0 ? tokens.accentText : tokens.textMuted },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.statBox, { backgroundColor: tokens.surfaceElevated }]}>
      <Text style={[styles.statValue, { color: tokens.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: tokens.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  barsContainer: {
    maxHeight: 240,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
    gap: 8,
  },
  barLabel: {
    width: 34,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
  },
  barFill: {
    minWidth: 28,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  barCount: {
    fontSize: 12,
    fontWeight: '800',
  },
});
