import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppContainer } from '../../components/AppContainer';
import { Header } from '../../components/Header';
import { ModeToggle } from '../../components/ModeToggle';
import { SearchInput, SearchSuggestion } from '../../components/SearchInput';
import { StatsModal } from '../../components/StatsModal';
import { ResultModal } from '../../components/ResultModal';
import { useTheme } from '../../theme/ThemeContext';
import { DailyCompletionRecord, GameMode, GameStats, TenaBallQuestion } from '../../types';
import {
  getDailyTenaBallQuestion,
  getRandomTenaBallQuestion,
} from '../../data/tenaballRepository';
import { searchGuessPool } from '../../data/playerRepository';
import { useDebouncedValue } from '../../utils/useDebouncedValue';
import { getLocalDateKey } from '../../utils/daily';
import {
  addTenaBallErrorReport,
  createEmptyStats,
  getAllowUnverifiedTenaBall,
  getDailyCompletion,
  getGameStats,
  getTenaBallAnimationsEnabled,
  getTenaBallErrorReports,
  getTenaBallSoundsEnabled,
  recordGameResult,
  saveDailyCompletion,
} from '../../utils/storage';
import { buildTenaBallShareText } from '../../utils/share';
import {
  createInitialTenaBallState,
  submitTenaBallGuess,
  TENABALL_MAX_LIVES,
  TenaBallState,
} from './tenaballLogic';
import { buildRevealSchedule } from './countdownAnimation';
import { playTickSound, preloadTickSound, stopTickSound, unloadTickSound } from './tickSound';
import { SlotRow } from './SlotRow';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const DIFFICULTY_LABEL: Record<TenaBallQuestion['difficulty'], string> = {
  kolay: 'Kolay',
  orta: 'Orta',
  zor: 'Zor',
};

export function TenaBallGame() {
  const { tokens } = useTheme();
  const router = useRouter();
  const dateKey = getLocalDateKey();

  const [mode, setMode] = useState<GameMode>('daily');
  const [allowUnverified, setAllowUnverified] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const [question, setQuestion] = useState<TenaBallQuestion | null>(() =>
    getDailyTenaBallQuestion(new Date(), false)
  );
  const [gameState, setGameState] = useState<TenaBallState>(createInitialTenaBallState);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; tone: 'success' | 'warn' | 'error' } | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  // Visual-only animation overlay state (game state is always updated & persisted immediately)
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [pendingRevealIndex, setPendingRevealIndex] = useState<number | null>(null);

  const [dailyRecord, setDailyRecord] = useState<DailyCompletionRecord | null>(null);
  const [stats, setStats] = useState<GameStats>(createEmptyStats);
  const [showStats, setShowStats] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pendingShowResultRef = useRef(false);
  const pendingFeedbackRef = useRef<{ text: string; tone: 'success' | 'warn' | 'error' } | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const clearAnimationTimers = useCallback(() => {
    for (const t of timersRef.current) {
      clearTimeout(t);
    }
    timersRef.current = [];
  }, []);

  // Preload sound & listen for OS Reduce Motion preference
  useEffect(() => {
    preloadTickSound().catch(() => {});
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setReduceMotion(Boolean(enabled)))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(Boolean(enabled));
    });
    return () => {
      sub.remove();
      clearAnimationTimers();
      stopTickSound().catch(() => {});
      unloadTickSound().catch(() => {});
    };
  }, [clearAnimationTimers]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [s, d, allow, reports, animOn, soundOn] = await Promise.all([
          getGameStats('tenaball'),
          getDailyCompletion('tenaball', dateKey),
          getAllowUnverifiedTenaBall(),
          getTenaBallErrorReports(),
          getTenaBallAnimationsEnabled(),
          getTenaBallSoundsEnabled(),
        ]);
        if (!active) return;
        setStats(s);
        setDailyRecord(d);
        setAllowUnverified(allow);
        setReportedIds(new Set(reports.map((r) => r.id)));
        setAnimationsEnabled(animOn);
        setSoundsEnabled(soundOn);
        setQuestion((prev) => {
          if (mode === 'daily') {
            return getDailyTenaBallQuestion(new Date(), allow);
          }
          if (!prev || (!allow && !prev.verified)) {
            return getRandomTenaBallQuestion(undefined, allow);
          }
          return prev;
        });
      })();
      return () => {
        active = false;
      };
    }, [dateKey, mode])
  );

  const skipRevealAnimation = useCallback(() => {
    if (!isAnimating) return;
    clearAnimationTimers();
    stopTickSound().catch(() => {});
    setHighlightedIndex(null);
    setPendingRevealIndex(null);
    setIsAnimating(false);
    if (pendingFeedbackRef.current) {
      setFeedback(pendingFeedbackRef.current);
      pendingFeedbackRef.current = null;
    }
    if (pendingShowResultRef.current) {
      pendingShowResultRef.current = false;
      setShowResult(true);
    }
  }, [isAnimating, clearAnimationTimers]);

  const triggerWrongShake = useCallback(() => {
    if (!animationsEnabled || reduceMotion) return;
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 45, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 45, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [animationsEnabled, reduceMotion, shakeAnim]);

  const startCountdownReveal = useCallback(
    (
      slotIndex: number,
      feedbackPayload: { text: string; tone: 'success' | 'warn' | 'error' },
      shouldOpenResultAfter: boolean
    ) => {
      clearAnimationTimers();
      const schedule = buildRevealSchedule(slotIndex + 1);
      const shouldPlayTick = soundsEnabled;

      setIsAnimating(true);
      setPendingRevealIndex(slotIndex);
      pendingFeedbackRef.current = feedbackPayload;
      pendingShowResultRef.current = shouldOpenResultAfter;

      let elapsed = 0;
      schedule.stepIndices.forEach((idx, stepPos) => {
        const t = setTimeout(() => {
          setHighlightedIndex(idx);
          if (shouldPlayTick) {
            playTickSound().catch(() => {});
          }
        }, elapsed);
        timersRef.current.push(t);
        elapsed += schedule.stepDurationsMs[stepPos];
      });

      const finishTimer = setTimeout(() => {
        setHighlightedIndex(null);
        setPendingRevealIndex(null);
        setIsAnimating(false);
        if (pendingFeedbackRef.current) {
          setFeedback(pendingFeedbackRef.current);
          pendingFeedbackRef.current = null;
        }
        if (pendingShowResultRef.current) {
          pendingShowResultRef.current = false;
          const modalTimer = setTimeout(() => setShowResult(true), 280);
          timersRef.current.push(modalTimer);
        }
      }, elapsed);
      timersRef.current.push(finishTimer);
    },
    [clearAnimationTimers, soundsEnabled]
  );

  const resetVisualAnimation = useCallback(() => {
    clearAnimationTimers();
    stopTickSound().catch(() => {});
    setHighlightedIndex(null);
    setPendingRevealIndex(null);
    setIsAnimating(false);
    pendingShowResultRef.current = false;
    pendingFeedbackRef.current = null;
  }, [clearAnimationTimers]);

  const startUnlimitedRound = useCallback(
    (excludeId?: string) => {
      resetVisualAnimation();
      setMode('unlimited');
      setQuestion(getRandomTenaBallQuestion(excludeId, allowUnverified));
      setGameState(createInitialTenaBallState());
      setInputValue('');
      setFeedback(null);
      setShowResult(false);
    },
    [allowUnverified, resetVisualAnimation]
  );

  const handleModeChange = (nextMode: GameMode) => {
    if (nextMode === mode) return;
    resetVisualAnimation();
    setMode(nextMode);
    setInputValue('');
    setFeedback(null);
    setShowResult(false);
    if (nextMode === 'daily') {
      setQuestion(getDailyTenaBallQuestion(new Date(), allowUnverified));
      setGameState(createInitialTenaBallState());
    } else {
      setQuestion(getRandomTenaBallQuestion(question?.id, allowUnverified));
      setGameState(createInitialTenaBallState());
    }
  };

  const handleReportError = async () => {
    if (!question) return;
    const next = await addTenaBallErrorReport({ id: question.id, title: question.title });
    setReportedIds(new Set(next.map((r) => r.id)));
  };

  const isDailyLocked = mode === 'daily' && Boolean(dailyRecord);
  const isFinished = !question || gameState.status !== 'playing' || isDailyLocked;

  const solvedFlags = useMemo(
    () => (question ? question.answers.map((_, idx) => gameState.solvedIndices.includes(idx)) : []),
    [question, gameState.solvedIndices]
  );

  const shareText = useMemo(() => {
    if (isDailyLocked && dailyRecord) return dailyRecord.shareText;
    if (!question) return '';
    return buildTenaBallShareText(
      mode,
      dateKey,
      question.title,
      solvedFlags,
      gameState.livesLeft,
      TENABALL_MAX_LIVES
    );
  }, [isDailyLocked, dailyRecord, mode, dateKey, question, solvedFlags, gameState.livesLeft]);

  const debouncedInput = useDebouncedValue(inputValue, 130);

  const suggestions: SearchSuggestion[] = useMemo(() => {
    if (!debouncedInput.trim() || isFinished || isAnimating) return [];
    return searchGuessPool(debouncedInput, 8).map((p) => ({
      id: p.id,
      label: p.name,
      sublabel: `${p.nationality} • ${p.position}`,
    }));
  }, [debouncedInput, isFinished, isAnimating]);

  const handleGuessSubmit = async (overrideGuess?: string) => {
    if (isFinished || isAnimating || !question) return;
    const rawGuess = overrideGuess ?? inputValue;
    const outcome = submitTenaBallGuess(gameState, rawGuess, question.answers);
    setInputValue('');

    if (outcome.type === 'ignored') return;
    if (outcome.type === 'duplicate') {
      setFeedback({ text: 'Bu oyuncuyu zaten buldun!', tone: 'warn' });
      return;
    }

    // 1. Update authoritative game state & persist IMMEDIATELY (independent of animation/sound)
    setGameState(outcome.nextState);
    const gameEnded = outcome.nextState.status !== 'playing';

    if (gameEnded) {
      const won = outcome.nextState.status === 'won';
      const foundCount = outcome.nextState.solvedIndices.length;
      const nextStats = await recordGameResult(
        'tenaball',
        won,
        String(foundCount),
        mode === 'daily' ? dateKey : undefined
      );
      setStats(nextStats);

      if (mode === 'daily') {
        const flags = question.answers.map((_, idx) =>
          outcome.nextState.solvedIndices.includes(idx)
        );
        const generatedShare = buildTenaBallShareText(
          'daily',
          dateKey,
          question.title,
          flags,
          outcome.nextState.livesLeft,
          TENABALL_MAX_LIVES
        );
        const rec: DailyCompletionRecord = {
          dateKey,
          puzzleId: question.id,
          won,
          scoreText: `${foundCount}/10`,
          shareText: generatedShare,
          completedAt: new Date().toISOString(),
        };
        await saveDailyCompletion('tenaball', rec);
        setDailyRecord(rec);
      }
    }

    // 2. Visual & audio presentation layer
    if (outcome.type === 'correct') {
      const successFeedback = {
        text: `Doğru! ${outcome.slotIndex + 1}. sıra: ${outcome.answer}`,
        tone: 'success' as const,
      };
      if (animationsEnabled && !reduceMotion) {
        startCountdownReveal(outcome.slotIndex, successFeedback, gameEnded);
      } else {
        setFeedback(successFeedback);
        if (gameEnded) {
          setTimeout(() => setShowResult(true), 300);
        }
      }
    } else {
      // Wrong answer: instant life drop, brief shake, NO tick sound
      setFeedback({
        text: `Listede yok! Kalan can: ${outcome.nextState.livesLeft}`,
        tone: 'error',
      });
      triggerWrongShake();
      if (gameEnded) {
        setTimeout(() => setShowResult(true), 350);
      }
    }
  };

  if (!question) {
    return (
      <AppContainer>
        <Header
          title="TenaBall"
          subtitle="Top 10 Futbol Listesi"
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
        <View style={styles.emptyWrap}>
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
            ]}
          >
            <View style={[styles.emptyIcon, { backgroundColor: tokens.accentSoft }]}>
              <Ionicons name="shield-checkmark-outline" size={32} color={tokens.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: tokens.text }]}>
              Henüz Doğrulanmış Liste Yok
            </Text>
            <Text style={[styles.emptyDesc, { color: tokens.textMuted }]}>
              TenaBall yalnızca kaynak bağlantısı üzerinden doğrulanmış (verified: true) Top 10
              listelerini gösterir. Listeler doğrulandığında burada otomatik olarak görünür. Bu
              sırada diğer oyunları oynayabilirsin!
            </Text>
            <View style={styles.emptyButtons}>
              <Pressable
                onPress={() => router.push('/settings')}
                style={[styles.emptyBtn, { backgroundColor: tokens.accent }]}
              >
                <Text style={[styles.emptyBtnText, { color: tokens.accentText }]}>
                  Ayarlar&apos;dan Doğrulanmamış Listeleri Aç
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace('/games/who-are-ya')}
                style={[styles.emptyBtn, { backgroundColor: tokens.footballGreen }]}
              >
                <Text style={[styles.emptyBtnText, { color: tokens.footballGreenText }]}>
                  Who Are Ya Oyna
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace('/games/wordle')}
                style={[styles.emptyBtn, { backgroundColor: tokens.surfaceElevated }]}
              >
                <Text style={[styles.emptyBtnText, { color: tokens.text }]}>
                  Football Wordle Oyna
                </Text>
              </Pressable>
              <Pressable onPress={() => router.replace('/')} style={styles.emptyBackBtn}>
                <Text style={[styles.emptyBackText, { color: tokens.textMuted }]}>
                  Ana Sayfaya Dön
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <StatsModal
          visible={showStats}
          onClose={() => setShowStats(false)}
          gameTitle="TenaBall"
          stats={stats}
          distributionLabels={['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0']}
          distributionHeading="Bulunan Oyuncu Dağılımı"
        />
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <Header
        title="TenaBall"
        subtitle="Top 10 Futbol Listesi"
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

      <View style={styles.gameBody}>
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

          {/* Question Card (shakes briefly on wrong answer) */}
          <Animated.View
            style={[
              styles.questionCard,
              {
                backgroundColor: tokens.surface,
                borderColor: tokens.border,
                transform: [{ translateX: shakeAnim }],
              },
            ]}
          >
            <View style={styles.badgesRow}>
              <View style={[styles.badge, { backgroundColor: tokens.accentSoft }]}>
                <Text style={[styles.badgeText, { color: tokens.accent }]}>{question.category}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: tokens.surfaceElevated }]}>
                <Text style={[styles.badgeText, { color: tokens.textMuted }]}>
                  {DIFFICULTY_LABEL[question.difficulty]}
                </Text>
              </View>
              {!question.verified && (
                <View style={[styles.unverifiedBadge, { backgroundColor: tokens.warning }]}>
                  <Ionicons name="warning-outline" size={13} color="#FFFFFF" />
                  <Text style={styles.unverifiedBadgeText}>Doğrulanmamış liste</Text>
                </View>
              )}
            </View>

            <Text style={[styles.questionTitle, { color: tokens.text }]}>{question.title}</Text>

            <View style={styles.statusRow}>
              <View style={styles.livesRow}>
                {Array.from({ length: TENABALL_MAX_LIVES }).map((_, idx) => (
                  <Ionicons
                    key={idx}
                    name={idx < gameState.livesLeft ? 'heart' : 'heart-outline'}
                    size={20}
                    color={idx < gameState.livesLeft ? tokens.danger : tokens.textMuted}
                  />
                ))}
              </View>
              <Text style={[styles.progressText, { color: tokens.accent }]}>
                {gameState.solvedIndices.length - (pendingRevealIndex !== null ? 1 : 0)} / 10
              </Text>
            </View>
          </Animated.View>

          {/* Input */}
          {!isDailyLocked ? (
            <View style={styles.inputSection}>
              <SearchInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Futbolcu adı veya soyadı yaz..."
                suggestions={suggestions}
                onSelectSuggestion={(item) => handleGuessSubmit(item.label)}
                onSubmit={() => handleGuessSubmit()}
                submitLabel="Tahmin"
                disabled={isFinished || isAnimating}
              />
              {feedback ? (
                <Text
                  style={[
                    styles.feedbackText,
                    {
                      color:
                        feedback.tone === 'success'
                          ? tokens.success
                          : feedback.tone === 'warn'
                            ? tokens.warning
                            : tokens.danger,
                    },
                  ]}
                >
                  {feedback.text}
                </Text>
              ) : null}
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
                onPress={() => startUnlimitedRound(question.id)}
                style={[styles.actionBtn, { backgroundColor: tokens.footballGreen }]}
              >
                <Ionicons name="infinite" size={16} color={tokens.footballGreenText} />
                <Text style={[styles.actionBtnText, { color: tokens.footballGreenText }]}>
                  Sınırsız Modda Oyna
                </Text>
              </Pressable>
            </View>
          )}

          {/* 10 Numbered Slots */}
          <View style={styles.slotsList}>
            {question.answers.map((ans, idx) => {
              const visuallySolved =
                gameState.solvedIndices.includes(idx) && pendingRevealIndex !== idx;
              const visuallyRevealedAtEnd =
                isFinished && !isAnimating && !gameState.solvedIndices.includes(idx);
              return (
                <SlotRow
                  key={`${question.id}-${idx}`}
                  rank={idx + 1}
                  answer={ans}
                  solved={visuallySolved}
                  revealedAtEnd={visuallyRevealedAtEnd}
                  highlighted={highlightedIndex === idx}
                  reduceMotion={reduceMotion || !animationsEnabled}
                />
              );
            })}
          </View>

          {isFinished && !isAnimating && (
            <View style={styles.endActions}>
              <Pressable
                onPress={handleReportError}
                disabled={reportedIds.has(question.id)}
                style={[
                  styles.reportInlineBtn,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: reportedIds.has(question.id) ? tokens.success : tokens.border,
                    opacity: reportedIds.has(question.id) ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={reportedIds.has(question.id) ? 'checkmark-circle-outline' : 'flag-outline'}
                  size={16}
                  color={reportedIds.has(question.id) ? tokens.success : tokens.danger}
                />
                <Text
                  style={[
                    styles.reportInlineText,
                    { color: reportedIds.has(question.id) ? tokens.success : tokens.text },
                  ]}
                >
                  {reportedIds.has(question.id)
                    ? `Hata Bildirildi (${question.id})`
                    : 'Bu listede hata var'}
                </Text>
              </Pressable>

              {mode === 'unlimited' && (
                <Pressable
                  onPress={() => startUnlimitedRound(question.id)}
                  style={[styles.nextBtn, { backgroundColor: tokens.footballGreen }]}
                >
                  <Ionicons name="refresh" size={18} color={tokens.footballGreenText} />
                  <Text style={[styles.nextBtnText, { color: tokens.footballGreenText }]}>
                    Yeni TenaBall Sorusu
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>

        {/* Transparent tap-to-skip overlay active ONLY during countdown animation */}
        {isAnimating && (
          <Pressable
            style={styles.skipOverlay}
            onPressIn={skipRevealAnimation}
            accessibilityLabel="Animasyonu atla"
          />
        )}
      </View>

      <StatsModal
        visible={showStats}
        onClose={() => setShowStats(false)}
        gameTitle="TenaBall"
        stats={stats}
        distributionLabels={['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0']}
        distributionHeading="Bulunan Oyuncu Dağılımı"
      />

      <ResultModal
        visible={showResult}
        onClose={() => setShowResult(false)}
        won={isDailyLocked ? Boolean(dailyRecord?.won) : gameState.status === 'won'}
        title={
          (isDailyLocked ? dailyRecord?.won : gameState.status === 'won')
            ? 'Tebrikler! 10/10!'
            : 'Oyun Bitti!'
        }
        subtitle={
          isDailyLocked && dailyRecord
            ? `Günün TenaBall skoru: ${dailyRecord.scoreText}`
            : `${gameState.solvedIndices.length} / 10 oyuncuyu doğru bildin.`
        }
        shareText={shareText}
        reportAction={{
          label: reportedIds.has(question.id)
            ? `Hata Bildirildi (${question.id})`
            : 'Bu listede hata var',
          reported: reportedIds.has(question.id),
          onPress: handleReportError,
        }}
        onPlayUnlimited={() => startUnlimitedRound(question.id)}
        playUnlimitedLabel={mode === 'daily' ? 'Sınırsız Modda Devam Et' : 'Yeni Soru Oyna'}
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
  gameBody: {
    flex: 1,
    position: 'relative',
  },
  skipOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'transparent',
  },
  scroll: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  questionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  unverifiedBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  livesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '900',
  },
  inputSection: {
    gap: 6,
  },
  feedbackText: {
    fontSize: 13,
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
  slotsList: {
    gap: 8,
  },
  endActions: {
    gap: 10,
    marginTop: 6,
  },
  reportInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
  },
  reportInlineText: {
    fontSize: 13.5,
    fontWeight: '700',
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
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  emptyButtons: {
    width: '100%',
    gap: 10,
  },
  emptyBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  emptyBackBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  emptyBackText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
});
