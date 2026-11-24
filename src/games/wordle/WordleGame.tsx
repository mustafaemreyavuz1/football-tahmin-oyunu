import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContainer } from '../../components/AppContainer';
import { Header } from '../../components/Header';
import { ModeToggle } from '../../components/ModeToggle';
import { StatsModal } from '../../components/StatsModal';
import { ResultModal } from '../../components/ResultModal';
import { useTheme } from '../../theme/ThemeContext';
import { DailyCompletionRecord, GameMode, GameStats, PuzzlePlayer } from '../../types';
import {
  getDailyWordlePlayer,
  getRandomWordlePlayer,
  isValidWordleSurname,
} from '../../data/playerRepository';
import { normalizeForWordle } from '../../utils/normalization';
import { getLocalDateKey } from '../../utils/daily';
import {
  createEmptyStats,
  getDailyCompletion,
  getGameStats,
  recordGameResult,
  saveDailyCompletion,
} from '../../utils/storage';
import { buildWordleShareText, WordleCellStatus } from '../../utils/share';
import {
  computeKeyboardStates,
  evaluateWordleGuess,
  WORDLE_MAX_ATTEMPTS,
} from './wordleLogic';
import { WordleGrid } from './WordleGrid';
import { WordleKeyboard } from './WordleKeyboard';

export function WordleGame() {
  const { tokens } = useTheme();
  const dateKey = getLocalDateKey();

  const [mode, setMode] = useState<GameMode>('daily');
  const [player, setPlayer] = useState<PuzzlePlayer>(() => getDailyWordlePlayer());
  const [guesses, setGuesses] = useState<string[]>([]);
  const [evaluations, setEvaluations] = useState<WordleCellStatus[][]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [hintShown, setHintShown] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [dailyRecord, setDailyRecord] = useState<DailyCompletionRecord | null>(null);
  const [stats, setStats] = useState<GameStats>(createEmptyStats);
  const [showStats, setShowStats] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const targetWord = useMemo(() => normalizeForWordle(player.surname), [player.surname]);
  const isMultiWord = player.surname.trim().includes(' ') || player.surname.includes('-');

  useEffect(() => {
    (async () => {
      const [s, d] = await Promise.all([
        getGameStats('wordle'),
        getDailyCompletion('wordle', dateKey),
      ]);
      setStats(s);
      setDailyRecord(d);
    })();
  }, [dateKey]);

  const startUnlimited = useCallback((excludeId?: string) => {
    setMode('unlimited');
    setPlayer(getRandomWordlePlayer(excludeId));
    setGuesses([]);
    setEvaluations([]);
    setCurrentGuess('');
    setStatus('playing');
    setHintShown(false);
    setMessage(null);
    setShowResult(false);
  }, []);

  const handleModeChange = (nextMode: GameMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setGuesses([]);
    setEvaluations([]);
    setCurrentGuess('');
    setStatus('playing');
    setHintShown(false);
    setMessage(null);
    setShowResult(false);
    if (nextMode === 'daily') {
      setPlayer(getDailyWordlePlayer());
    } else {
      setPlayer(getRandomWordlePlayer(player.id));
    }
  };

  const isDailyLocked = mode === 'daily' && Boolean(dailyRecord);
  const isFinished = status !== 'playing' || isDailyLocked;

  const keyStates = useMemo(
    () => computeKeyboardStates(guesses, evaluations),
    [guesses, evaluations]
  );

  const shareText = useMemo(() => {
    if (isDailyLocked && dailyRecord) return dailyRecord.shareText;
    return buildWordleShareText(
      mode,
      dateKey,
      evaluations,
      status === 'won',
      WORDLE_MAX_ATTEMPTS
    );
  }, [isDailyLocked, dailyRecord, mode, dateKey, evaluations, status]);

  const handleKeyPress = useCallback(
    async (key: string) => {
      if (isFinished) return;
      setMessage(null);

      if (key === 'BACK') {
        setCurrentGuess((prev) => prev.slice(0, -1));
        return;
      }

      if (key === 'ENTER') {
        if (currentGuess.length < targetWord.length) {
          setMessage(`Lütfen ${targetWord.length} harf gir.`);
          return;
        }
        if (currentGuess !== targetWord && !isValidWordleSurname(currentGuess)) {
          setMessage('Bu soyad oyuncu havuzunda bulunamadı.');
          return;
        }
        const evalRow = evaluateWordleGuess(currentGuess, targetWord);
        const nextGuesses = [...guesses, currentGuess];
        const nextEvals = [...evaluations, evalRow];
        setGuesses(nextGuesses);
        setEvaluations(nextEvals);
        setCurrentGuess('');

        const won = currentGuess === targetWord;
        const lost = !won && nextGuesses.length >= WORDLE_MAX_ATTEMPTS;

        if (won || lost) {
          setStatus(won ? 'won' : 'lost');
          const distKey = won ? String(nextGuesses.length) : 'X';
          const nextStats = await recordGameResult(
            'wordle',
            won,
            distKey,
            mode === 'daily' ? dateKey : undefined
          );
          setStats(nextStats);

          if (mode === 'daily') {
            const generatedShare = buildWordleShareText(
              'daily',
              dateKey,
              nextEvals,
              won,
              WORDLE_MAX_ATTEMPTS
            );
            const rec: DailyCompletionRecord = {
              dateKey,
              puzzleId: player.id,
              won,
              scoreText: won
                ? `${nextGuesses.length}/${WORDLE_MAX_ATTEMPTS}`
                : `X/${WORDLE_MAX_ATTEMPTS}`,
              shareText: generatedShare,
              completedAt: new Date().toISOString(),
            };
            await saveDailyCompletion('wordle', rec);
            setDailyRecord(rec);
          }

          setTimeout(() => setShowResult(true), 550);
        }
        return;
      }

      // Letter input (normalize Turkish/accented physical keys too)
      const normChar = normalizeForWordle(key);
      if (normChar.length === 1 && currentGuess.length < targetWord.length) {
        setCurrentGuess((prev) => prev + normChar);
      }
    },
    [isFinished, currentGuess, targetWord, guesses, evaluations, mode, dateKey, player.id]
  );

  // Physical keyboard support on Web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleKeyPress('ENTER');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeyPress('BACK');
      } else if (e.key.length === 1) {
        const norm = normalizeForWordle(e.key);
        if (norm.length === 1) {
          e.preventDefault();
          handleKeyPress(norm);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKeyPress]);

  return (
    <AppContainer>
      <Header
        title="Football Wordle"
        subtitle="Futbolcunun soyadını tahmin et"
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
        showsVerticalScrollIndicator={false}
      >
        <ModeToggle
          mode={mode}
          onChangeMode={handleModeChange}
          dailyCompleted={Boolean(dailyRecord)}
        />

        {/* Puzzle Meta & Optional Hint */}
        <View style={[styles.infoCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoText, { color: tokens.text }]}>
              Soyad uzunluğu:{' '}
              <Text style={{ fontWeight: '900', color: tokens.accent }}>
                {targetWord.length} harf
              </Text>
            </Text>
            <Pressable
              onPress={() => setHintShown(true)}
              disabled={hintShown}
              style={[
                styles.hintBtn,
                {
                  backgroundColor: hintShown ? tokens.surfaceElevated : tokens.accentSoft,
                },
              ]}
            >
              <Ionicons
                name="bulb-outline"
                size={15}
                color={hintShown ? tokens.textMuted : tokens.accent}
              />
              <Text
                style={[
                  styles.hintBtnText,
                  { color: hintShown ? tokens.textMuted : tokens.accent },
                ]}
              >
                {hintShown ? 'İpucu Açık' : 'İpucu Al'}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.normNote, { color: tokens.textMuted }]}>
            Türkçe ve aksanlı harfler sadeleştirilir (ç→C, ğ→G, ı→I, ö→O, ş→S, ü→U, é→E).
            {isMultiWord ? ' Çok kelimeli soyad bitişik yazılır.' : ''}
          </Text>

          {hintShown && (
            <View style={[styles.hintBox, { backgroundColor: tokens.accentSoft }]}>
              <Text style={[styles.hintText, { color: tokens.text }]}>
                Mevki: <Text style={{ fontWeight: '800' }}>{player.position}</Text> • Ülke:{' '}
                <Text style={{ fontWeight: '800' }}>{player.nationality}</Text>
              </Text>
            </View>
          )}
        </View>

        {message ? <Text style={[styles.message, { color: tokens.warning }]}>{message}</Text> : null}

        {isDailyLocked ? (
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
              onPress={() => startUnlimited(player.id)}
              style={[styles.actionBtn, { backgroundColor: tokens.footballGreen }]}
            >
              <Ionicons name="infinite" size={16} color={tokens.footballGreenText} />
              <Text style={[styles.actionBtnText, { color: tokens.footballGreenText }]}>
                Sınırsız Modda Oyna
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <WordleGrid
              wordLength={targetWord.length}
              guesses={guesses}
              evaluations={evaluations}
              currentGuess={currentGuess}
            />

            <WordleKeyboard
              keyStates={keyStates}
              onKeyPress={handleKeyPress}
              disabled={isFinished}
            />
          </>
        )}

        {mode === 'unlimited' && isFinished && (
          <Pressable
            onPress={() => startUnlimited(player.id)}
            style={[styles.nextBtn, { backgroundColor: tokens.footballGreen }]}
          >
            <Ionicons name="refresh" size={18} color={tokens.footballGreenText} />
            <Text style={[styles.nextBtnText, { color: tokens.footballGreenText }]}>
              Yeni Wordle Oyna
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <StatsModal
        visible={showStats}
        onClose={() => setShowStats(false)}
        gameTitle="Football Wordle"
        stats={stats}
        distributionLabels={['1', '2', '3', '4', '5', '6', 'X']}
      />

      <ResultModal
        visible={showResult}
        onClose={() => setShowResult(false)}
        won={isDailyLocked ? Boolean(dailyRecord?.won) : status === 'won'}
        title={
          (isDailyLocked ? dailyRecord?.won : status === 'won')
            ? 'Harika! Doğru Soyad!'
            : 'Deneme Hakkın Bitti!'
        }
        subtitle={`Cevap: ${player.name} (${player.surname} → ${targetWord})`}
        shareText={shareText}
        onPlayUnlimited={() => startUnlimited(player.id)}
        playUnlimitedLabel={mode === 'daily' ? 'Sınırsız Modda Devam Et' : 'Yeni Kelime Oyna'}
      />
    </AppContainer>
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
    paddingBottom: 32,
    gap: 12,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hintBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  normNote: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  hintBox: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  hintText: {
    fontSize: 13,
  },
  message: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
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
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
