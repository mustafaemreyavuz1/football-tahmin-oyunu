import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContainer } from '../../components/AppContainer';
import { Header } from '../../components/Header';
import { ModeToggle } from '../../components/ModeToggle';
import { SearchInput, SearchSuggestion } from '../../components/SearchInput';
import { StatsModal } from '../../components/StatsModal';
import { ResultModal } from '../../components/ResultModal';
import { useTheme } from '../../theme/ThemeContext';
import { DailyCompletionRecord, GameMode, GameStats, Player } from '../../types';
import {
  getDailyWhoAreYaPlayer,
  getPlayerById,
  getRandomWhoAreYaPlayer,
  searchPlayers,
} from '../../data/playerRepository';
import { getLocalDateKey } from '../../utils/daily';
import {
  createEmptyStats,
  getDailyCompletion,
  getGameStats,
  recordGameResult,
  saveDailyCompletion,
} from '../../utils/storage';
import { buildWhoAreYaShareText } from '../../utils/share';
import {
  evaluateWhoAreYaGuess,
  getBlurAmount,
  WHO_ARE_YA_MAX_ATTEMPTS,
  WhoAreYaGuessFeedback,
} from './whoAreYaLogic';
import { BlurredPlayerPhoto } from './BlurredPlayerPhoto';

export function WhoAreYaGame() {
  const { tokens } = useTheme();
  const dateKey = getLocalDateKey();

  const [mode, setMode] = useState<GameMode>('daily');
  const [target, setTarget] = useState<Player>(() => getDailyWhoAreYaPlayer());
  const [guesses, setGuesses] = useState<WhoAreYaGuessFeedback[]>([]);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const [dailyRecord, setDailyRecord] = useState<DailyCompletionRecord | null>(null);
  const [stats, setStats] = useState<GameStats>(createEmptyStats);
  const [showStats, setShowStats] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, d] = await Promise.all([
        getGameStats('who-are-ya'),
        getDailyCompletion('who-are-ya', dateKey),
      ]);
      setStats(s);
      setDailyRecord(d);
    })();
  }, [dateKey]);

  const startUnlimited = useCallback((excludeId?: string) => {
    setMode('unlimited');
    setTarget(getRandomWhoAreYaPlayer(excludeId));
    setGuesses([]);
    setStatus('playing');
    setQuery('');
    setNotice(null);
    setShowResult(false);
  }, []);

  const handleModeChange = (nextMode: GameMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setGuesses([]);
    setStatus('playing');
    setQuery('');
    setNotice(null);
    setShowResult(false);
    if (nextMode === 'daily') {
      setTarget(getDailyWhoAreYaPlayer());
    } else {
      setTarget(getRandomWhoAreYaPlayer(target.id));
    }
  };

  const isDailyLocked = mode === 'daily' && Boolean(dailyRecord);
  const isFinished = status !== 'playing' || isDailyLocked;

  const guessedIds = useMemo(() => new Set(guesses.map((g) => g.guessedPlayer.id)), [guesses]);

  const suggestions: SearchSuggestion[] = useMemo(() => {
    if (!query.trim()) return [];
    return searchPlayers(query, 7)
      .filter((p) => !guessedIds.has(p.id))
      .map((p) => ({
        id: p.id,
        label: p.name,
        sublabel: `${p.nationality} • ${p.position}`,
      }));
  }, [query, guessedIds]);

  const wrongCount = guesses.filter((g) => !g.isCorrect).length;
  const blurAmount = getBlurAmount(wrongCount, isFinished);

  const shareText = useMemo(() => {
    if (isDailyLocked && dailyRecord) return dailyRecord.shareText;
    return buildWhoAreYaShareText(
      mode,
      dateKey,
      guesses.map((g) => g.isCorrect),
      status === 'won',
      WHO_ARE_YA_MAX_ATTEMPTS
    );
  }, [isDailyLocked, dailyRecord, mode, dateKey, guesses, status]);

  const submitPlayerGuess = async (player: Player) => {
    if (isFinished) return;
    if (guessedIds.has(player.id)) {
      setNotice('Bu futbolcuyu zaten denedin.');
      return;
    }

    const fb = evaluateWhoAreYaGuess(player, target);
    const nextGuesses = [...guesses, fb];
    setGuesses(nextGuesses);
    setQuery('');
    setNotice(null);

    const won = fb.isCorrect;
    const lost = !won && nextGuesses.length >= WHO_ARE_YA_MAX_ATTEMPTS;

    if (won || lost) {
      const finalStatus = won ? 'won' : 'lost';
      setStatus(finalStatus);
      const distKey = won ? String(nextGuesses.length) : 'X';
      const nextStats = await recordGameResult(
        'who-are-ya',
        won,
        distKey,
        mode === 'daily' ? dateKey : undefined
      );
      setStats(nextStats);

      if (mode === 'daily') {
        const generatedShare = buildWhoAreYaShareText(
          'daily',
          dateKey,
          nextGuesses.map((g) => g.isCorrect),
          won,
          WHO_ARE_YA_MAX_ATTEMPTS
        );
        const rec: DailyCompletionRecord = {
          dateKey,
          puzzleId: target.id,
          won,
          scoreText: won ? `${nextGuesses.length}/${WHO_ARE_YA_MAX_ATTEMPTS}` : `X/${WHO_ARE_YA_MAX_ATTEMPTS}`,
          shareText: generatedShare,
          completedAt: new Date().toISOString(),
        };
        await saveDailyCompletion('who-are-ya', rec);
        setDailyRecord(rec);
      }

      setTimeout(() => setShowResult(true), 500);
    }
  };

  const handleSelectSuggestion = (item: SearchSuggestion) => {
    const player = getPlayerById(item.id);
    if (player) {
      submitPlayerGuess(player);
    }
  };

  const handleManualSubmit = () => {
    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
    } else if (query.trim()) {
      setNotice('Listeden bir futbolcu seçmelisin.');
    }
  };

  return (
    <AppContainer>
      <Header
        title="Who Are Ya"
        subtitle="Bulanık fotoğraftan futbolcuyu tahmin et"
        rightActions={
          <Pressable
            onPress={() => setShowStats(true)}
            style={[styles.headerBtn, { backgroundColor: tokens.surfaceElevated }]}
            accessibilityLabel="İstatistikler"
          >
            <Ionicons name="bar-chart-outline" size={20} color={tokens.text} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ModeToggle
          mode={mode}
          onChangeMode={handleModeChange}
          dailyCompleted={Boolean(dailyRecord)}
        />

        <BlurredPlayerPhoto
          player={target}
          blurAmount={blurAmount}
          revealed={isFinished}
          attemptLabel={`Deneme ${Math.min(guesses.length + (isFinished ? 0 : 1), WHO_ARE_YA_MAX_ATTEMPTS)} / ${WHO_ARE_YA_MAX_ATTEMPTS}`}
        />

        {!isDailyLocked ? (
          <View style={styles.searchSection}>
            <SearchInput
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setNotice(null);
              }}
              placeholder="Futbolcu ara (örn. Messi, Arda Güler)..."
              suggestions={suggestions}
              onSelectSuggestion={handleSelectSuggestion}
              onSubmit={handleManualSubmit}
              disabled={isFinished}
            />
            {notice ? <Text style={[styles.notice, { color: tokens.warning }]}>{notice}</Text> : null}
          </View>
        ) : (
          <View style={styles.lockedActions}>
            <Pressable
              onPress={() => setShowResult(true)}
              style={[styles.actionBtn, { backgroundColor: tokens.accent }]}
            >
              <Ionicons name="share-social" size={16} color={tokens.accentText} />
              <Text style={[styles.actionBtnText, { color: tokens.accentText }]}>
                Günün Sonucunu Gör
              </Text>
            </Pressable>
            <Pressable
              onPress={() => startUnlimited(target.id)}
              style={[styles.actionBtn, { backgroundColor: tokens.footballGreen }]}
            >
              <Ionicons name="infinite" size={16} color={tokens.footballGreenText} />
              <Text style={[styles.actionBtnText, { color: tokens.footballGreenText }]}>
                Sınırsız Modda Oyna
              </Text>
            </Pressable>
          </View>
        )}

        {/* Guess Feedback Cards */}
        {guesses.length > 0 && (
          <View style={styles.guessList}>
            {guesses
              .slice()
              .reverse()
              .map((g, idx) => (
                <View
                  key={g.guessedPlayer.id}
                  style={[
                    styles.guessCard,
                    {
                      backgroundColor: tokens.surface,
                      borderColor: g.isCorrect ? tokens.success : tokens.border,
                    },
                  ]}
                >
                  <View style={styles.guessHeader}>
                    <Text style={[styles.guessName, { color: tokens.text }]}>
                      #{guesses.length - idx} {g.guessedPlayer.name}
                    </Text>
                    <Ionicons
                      name={g.isCorrect ? 'checkmark-circle' : 'close-circle'}
                      size={18}
                      color={g.isCorrect ? tokens.success : tokens.danger}
                    />
                  </View>

                  <View style={styles.chipsRow}>
                    <FeedbackChip
                      label="Ülke"
                      value={g.guessedPlayer.nationality}
                      match={g.nationalityMatch}
                    />
                    <FeedbackChip
                      label="Mevki"
                      value={g.guessedPlayer.position}
                      match={g.positionMatch}
                    />
                    <FeedbackChip
                      label="Doğum"
                      value={`${g.guessedPlayer.birthYear} ${
                        g.birthYearComparison === 'exact'
                          ? '✓'
                          : g.birthYearComparison === 'higher'
                            ? '↑'
                            : '↓'
                      }`}
                      match={g.birthYearComparison === 'exact'}
                    />
                    <FeedbackChip
                      label="Ortak Kulüp"
                      value={g.sharedClub ?? 'Yok'}
                      match={Boolean(g.sharedClub)}
                    />
                  </View>
                </View>
              ))}
          </View>
        )}

        {mode === 'unlimited' && isFinished && (
          <Pressable
            onPress={() => startUnlimited(target.id)}
            style={[styles.nextBtn, { backgroundColor: tokens.footballGreen }]}
          >
            <Ionicons name="refresh" size={18} color={tokens.footballGreenText} />
            <Text style={[styles.nextBtnText, { color: tokens.footballGreenText }]}>
              Yeni Futbolcu Getir
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <StatsModal
        visible={showStats}
        onClose={() => setShowStats(false)}
        gameTitle="Who Are Ya"
        stats={stats}
        distributionLabels={['1', '2', '3', '4', '5', '6', 'X']}
      />

      <ResultModal
        visible={showResult}
        onClose={() => setShowResult(false)}
        won={isDailyLocked ? Boolean(dailyRecord?.won) : status === 'won'}
        title={
          (isDailyLocked ? dailyRecord?.won : status === 'won')
            ? 'Doğru Bildin!'
            : 'Bilemedin!'
        }
        subtitle={`Futbolcu: ${target.name} (${target.nationality} • ${target.position})`}
        shareText={shareText}
        onPlayUnlimited={() => startUnlimited(target.id)}
        playUnlimitedLabel={mode === 'daily' ? 'Sınırsız Modda Devam Et' : 'Yeni Futbolcu Oyna'}
      />
    </AppContainer>
  );
}

function FeedbackChip({ label, value, match }: { label: string; value: string; match: boolean }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: match ? tokens.success : tokens.surfaceElevated,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: match ? '#FFFFFF' : tokens.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[styles.chipVal, { color: match ? '#FFFFFF' : tokens.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  searchSection: {
    gap: 6,
  },
  notice: {
    fontSize: 12.5,
    fontWeight: '700',
    paddingLeft: 4,
  },
  lockedActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 11,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  guessList: {
    gap: 10,
  },
  guessCard: {
    borderRadius: 13,
    borderWidth: 1.2,
    padding: 12,
    gap: 8,
  },
  guessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guessName: {
    fontSize: 15,
    fontWeight: '800',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: '23%',
    flexGrow: 1,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.85,
  },
  chipVal: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
