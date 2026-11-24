import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppContainer } from '../src/components/AppContainer';
import { TeamColorDot } from '../src/components/TeamColorDot';
import { useTheme } from '../src/theme/ThemeContext';
import { GameId, GameStats } from '../src/types';
import { getDailyCompletion, getGameStats } from '../src/utils/storage';
import { getLocalDateKey } from '../src/utils/daily';

interface GameCardMeta {
  id: GameId;
  title: string;
  tagline: string;
  details: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: '/games/tenaball' | '/games/who-are-ya' | '/games/wordle';
}

const GAMES: GameCardMeta[] = [
  {
    id: 'tenaball',
    title: 'TenaBall',
    tagline: 'Top 10 Futbol Listesi',
    details: 'Verilen futbol kategorisindeki ilk 10 oyuncuyu bul. 5 canın var, süre sınırı yok.',
    icon: 'list-circle',
    route: '/games/tenaball',
  },
  {
    id: 'who-are-ya',
    title: 'Who Are Ya',
    tagline: 'Bulanık Fotoğraftan Bil',
    details: 'Her yanlış tahminde fotoğraf netleşir ve yeni ipuçları açılır. Maksimum 6 deneme.',
    icon: 'eye',
    route: '/games/who-are-ya',
  },
  {
    id: 'wordle',
    title: 'Football Wordle',
    tagline: 'Soyadı Harf Harf Çöz',
    details: 'Futbolcunun soyadını 6 denemede bul. Dinamik harf sayısı ve isteğe bağlı ipucu.',
    icon: 'grid',
    route: '/games/wordle',
  },
];

export default function HomeScreen() {
  const { tokens, selectedTeam } = useTheme();
  const router = useRouter();
  const [statsMap, setStatsMap] = useState<Record<GameId, GameStats | null>>({
    tenaball: null,
    'who-are-ya': null,
    wordle: null,
  });
  const [dailyDoneMap, setDailyDoneMap] = useState<Record<GameId, boolean>>({
    tenaball: false,
    'who-are-ya': false,
    wordle: false,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const today = getLocalDateKey();
      (async () => {
        const [tbStats, wayStats, wdStats, tbDaily, wayDaily, wdDaily] = await Promise.all([
          getGameStats('tenaball'),
          getGameStats('who-are-ya'),
          getGameStats('wordle'),
          getDailyCompletion('tenaball', today),
          getDailyCompletion('who-are-ya', today),
          getDailyCompletion('wordle', today),
        ]);
        if (!active) return;
        setStatsMap({ tenaball: tbStats, 'who-are-ya': wayStats, wordle: wdStats });
        setDailyDoneMap({
          tenaball: Boolean(tbDaily),
          'who-are-ya': Boolean(wayDaily),
          wordle: Boolean(wdDaily),
        });
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <AppContainer>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Header */}
        <View
          style={[
            styles.hero,
            { backgroundColor: tokens.footballGreen },
          ]}
        >
          <View style={styles.heroTop}>
            <View style={styles.brandRow}>
              <Ionicons name="football" size={24} color={tokens.footballGreenText} />
              <Text style={[styles.brandTitle, { color: tokens.footballGreenText }]}>
                Football Tahmin Oyunu
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [
                styles.settingsBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityLabel="Ayarlar"
            >
              <Ionicons name="settings-outline" size={22} color={tokens.footballGreenText} />
            </Pressable>
          </View>

          <Text style={[styles.heroSub, { color: tokens.footballGreenText }]}>
            Günlük bulmacaları çöz, skorunu arkadaşlarınla paylaş!
          </Text>

          <Pressable
            onPress={() => router.push('/settings')}
            style={[styles.teamChip, { backgroundColor: tokens.accent }]}
          >
            {selectedTeam ? (
              <TeamColorDot
                primaryColor={selectedTeam.primaryColor}
                secondaryColor={selectedTeam.secondaryColor}
                size={20}
              />
            ) : (
              <Ionicons name="color-palette-outline" size={16} color={tokens.accentText} />
            )}
            <Text style={[styles.teamChipText, { color: tokens.accentText }]}>
              {selectedTeam ? `${selectedTeam.name} Teması` : 'Varsayılan Tema • Takım Seç'}
            </Text>
          </Pressable>
        </View>

        {/* 3 Game Cards */}
        <Text style={[styles.sectionTitle, { color: tokens.text }]}>Oyunlar</Text>

        <View style={styles.cards}>
          {GAMES.map((game) => {
            const st = statsMap[game.id];
            const dailyDone = dailyDoneMap[game.id];
            return (
              <Pressable
                key={game.id}
                onPress={() => router.push(game.route)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: tokens.border,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <View style={[styles.cardAccentBar, { backgroundColor: tokens.accent }]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: tokens.accentSoft }]}>
                      <Ionicons name={game.icon} size={24} color={tokens.accent} />
                    </View>
                    <View style={styles.cardTitleWrap}>
                      <Text style={[styles.cardTitle, { color: tokens.text }]}>{game.title}</Text>
                      <Text style={[styles.cardTagline, { color: tokens.accent }]}>
                        {game.tagline}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.dailyPill,
                        {
                          backgroundColor: dailyDone ? tokens.success : tokens.surfaceElevated,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dailyPillText,
                          { color: dailyDone ? '#FFFFFF' : tokens.textMuted },
                        ]}
                      >
                        {dailyDone ? 'Günlük ✓' : 'Günlük Hazır'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.cardDesc, { color: tokens.textMuted }]}>{game.details}</Text>

                  <View style={[styles.cardFooter, { borderTopColor: tokens.border }]}>
                    <View style={styles.miniStats}>
                      <Text style={[styles.miniStatText, { color: tokens.textMuted }]}>
                        Oynanan: <Text style={{ color: tokens.text, fontWeight: '700' }}>{st?.gamesPlayed ?? 0}</Text>
                      </Text>
                      <Text style={[styles.miniStatText, { color: tokens.textMuted }]}>
                        Seri: <Text style={{ color: tokens.text, fontWeight: '700' }}>{st?.currentStreak ?? 0}</Text>
                      </Text>
                    </View>
                    <View style={[styles.playBtn, { backgroundColor: tokens.accent }]}>
                      <Text style={[styles.playBtnText, { color: tokens.accentText }]}>Oyna</Text>
                      <Ionicons name="arrow-forward" size={14} color={tokens.accentText} />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  hero: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSub: {
    fontSize: 13.5,
    marginTop: 8,
    opacity: 0.92,
  },
  teamChip: {
    alignSelf: 'flex-start',
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  teamChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  cards: {
    gap: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardAccentBar: {
    height: 4,
    width: '100%',
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardTagline: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 1,
  },
  dailyPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dailyPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardDesc: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 12,
  },
  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniStats: {
    flexDirection: 'row',
    gap: 14,
  },
  miniStatText: {
    fontSize: 12.5,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  playBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
