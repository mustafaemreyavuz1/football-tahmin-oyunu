import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContainer } from '../../components/AppContainer';
import { Header } from '../../components/Header';
import { ModeToggle } from '../../components/ModeToggle';
import { SearchInput } from '../../components/SearchInput';
import { StatsModal } from '../../components/StatsModal';
import { ResultModal } from '../../components/ResultModal';
import { useTheme } from '../../theme/ThemeContext';
import { DailyCompletionRecord, GameMode, GameStats, TenaBallQuestion } from '../../types';
import {
  getDailyTenaBallQuestion,
  getRandomTenaBallQuestion,
} from '../../data/tenaballRepository';
import { getLocalDateKey } from '../../utils/daily';
import {
  createEmptyStats,
  getDailyCompletion,
  getGameStats,
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
import { SlotRow } from './SlotRow';

const DIFFICULTY_LABEL: Record<TenaBallQuestion['difficulty'], string> = {
  kolay: 'Kolay',
  orta: 'Orta',
  zor: 'Zor',
};

export function TenaBallGame() {
  const { tokens } = useTheme();
  const dateKey = getLocalDateKey();

  const [mode, setMode] = useState<GameMode>('daily');
  const [question, setQuestion] = useState<TenaBallQuestion>(() => getDailyTenaBallQuestion());
  const [gameState, setGameState] = useState<TenaBallState>(createInitialTenaBallState);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; tone: 'success' | 'warn' | 'error' } | null>(null);

  const [dailyRecord, setDailyRecord] = useState<DailyCompletionRecord | null>(null);
  const [stats, setStats] = useState<GameStats>(createEmptyStats);
  const [showStats, setShowStats] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, d] = await Promise.all([
        getGameStats('tenaball'),
        getDailyCompletion('tenaball', dateKey),
      ]);
      setStats(s);
      setDailyRecord(d);
    })();
  }, [dateKey]);

  const startUnlimitedRound = useCallback((excludeId?: string) => {
    setMode('unlimited');
    setQuestion(getRandomTenaBallQuestion(excludeId));
    setGameState(createInitialTenaBallState());
    setInputValue('');
    setFeedback(null);
    setShowResult(false);
  }, []);

  const handleModeChange = (nextMode: GameMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setInputValue('');
    setFeedback(null);
    setShowResult(false);
    if (nextMode === 'daily') {
      setQuestion(getDailyTenaBallQuestion());
      setGameState(createInitialTenaBallState());
    } else {
      setQuestion(getRandomTenaBallQuestion(question.id));
      setGameState(createInitialTenaBallState());
    }
  };

  const isDailyLocked = mode === 'daily' && Boolean(dailyRecord);
  const isFinished = gameState.status !== 'playing' || isDailyLocked;

  const solvedFlags = useMemo(
    () => question.answers.map((_, idx) => gameState.solvedIndices.includes(idx)),
    [question.answers, gameState.solvedIndices]
  );

  const shareText = useMemo(() => {
    if (isDailyLocked && dailyRecord) return dailyRecord.shareText;
    return buildTenaBallShareText(
      mode,
      dateKey,
      question.title,
      solvedFlags,
      gameState.livesLeft,
      TENABALL_MAX_LIVES
    );
  }, [isDailyLocked, dailyRecord, mode, dateKey, question.title, solvedFlags, gameState.livesLeft]);

  const handleGuessSubmit = async () => {
    if (isFinished) return;
    const outcome = submitTenaBallGuess(gameState, inputValue, question.answers);
    setInputValue('');

    if (outcome.type === 'ignored') return;
    if (outcome.type === 'duplicate') {
      setFeedback({ text: 'Bu oyuncuyu zaten buldun!', tone: 'warn' });
      return;
    }

    setGameState(outcome.nextState);

    if (outcome.type === 'correct') {
      setFeedback({
        text: `Doğru! ${outcome.slotIndex + 1}. sıra: ${outcome.answer}`,
        tone: 'success',
      });
    } else {
      setFeedback({
        text: `Listede yok! Kalan can: ${outcome.nextState.livesLeft}`,
        tone: 'error',
      });
    }

    if (outcome.nextState.status !== 'playing') {
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

      setTimeout(() => setShowResult(true), 450);
    }
  };

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

        {/* Question Card */}
        <View style={[styles.questionCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
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
              <View style={[styles.badge, { backgroundColor: tokens.surfaceElevated }]}>
                <Text style={[styles.badgeText, { color: tokens.textMuted }]}>
                  Veri: {question.asOf}
                </Text>
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
              {gameState.solvedIndices.length} / 10
            </Text>
          </View>
        </View>

        {/* Input */}
        {!isDailyLocked ? (
          <View style={styles.inputSection}>
            <SearchInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="Futbolcu adı veya soyadı yaz..."
              onSubmit={handleGuessSubmit}
              submitLabel="Tahmin"
              disabled={isFinished}
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
          {question.answers.map((ans, idx) => (
            <SlotRow
              key={`${question.id}-${idx}`}
              rank={idx + 1}
              answer={ans}
              solved={gameState.solvedIndices.includes(idx)}
              revealedAtEnd={isFinished && !gameState.solvedIndices.includes(idx)}
            />
          ))}
        </View>

        {mode === 'unlimited' && isFinished && (
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
      </ScrollView>

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
