import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AppContainer } from '../src/components/AppContainer';
import { Header } from '../src/components/Header';
import { SearchInput } from '../src/components/SearchInput';
import { getPuzzlePool } from '../src/data/playerRepository';
import { useTheme } from '../src/theme/ThemeContext';
import { PuzzlePlayer } from '../src/types';
import { normalizeText } from '../src/utils/normalization';

export default function AttributionsScreen() {
  const { tokens } = useTheme();
  const [query, setQuery] = useState('');

  const allPlayers = useMemo(
    () => getPuzzlePool().slice().sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    []
  );

  const filtered = useMemo(() => {
    const norm = normalizeText(query);
    if (!norm) return allPlayers;
    return allPlayers.filter(
      (p) =>
        normalizeText(p.name).includes(norm) ||
        normalizeText(p.imageAttribution).includes(norm) ||
        normalizeText(p.imageLicense).includes(norm)
    );
  }, [allPlayers, query]);

  return (
    <AppContainer>
      <Header
        title="Görsel Atıfları"
        subtitle={`${allPlayers.length} doğrulanmış oyuncu fotoğrafı (Wikimedia Commons)`}
      />

      <View style={styles.topSection}>
        <Text style={[styles.intro, { color: tokens.textMuted }]}>
          Who Are Ya oyununda kullanılan tüm fotoğraflar Wikimedia Commons üzerinden Creative
          Commons (CC BY / CC BY-SA), GFDL veya Kamu Malı lisanslarıyla sunulmaktadır.
        </Text>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Oyuncu, yazar veya lisans ara..."
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item: PuzzlePlayer) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }: { item: PuzzlePlayer }) => (
          <View
            style={[
              styles.row,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
            ]}
          >
            <View style={styles.rowHeader}>
              <Text style={[styles.playerName, { color: tokens.text }]}>{item.name}</Text>
              <View style={[styles.licenseBadge, { backgroundColor: tokens.accentSoft }]}>
                <Text style={[styles.licenseText, { color: tokens.accent }]}>
                  {item.imageLicense}
                </Text>
              </View>
            </View>
            <Text style={[styles.sourceText, { color: tokens.textMuted }]}>
              {item.imageAttribution}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: tokens.textMuted }]}>
            Aramana uygun görsel atıfı bulunamadı.
          </Text>
        }
      />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  topSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  intro: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 8,
  },
  row: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  playerName: {
    fontSize: 14.5,
    fontWeight: '800',
    flex: 1,
  },
  licenseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  licenseText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sourceText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  empty: {
    textAlign: 'center',
    marginTop: 28,
    fontSize: 14,
  },
});
