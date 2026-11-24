export const MAX_REVEAL_TOTAL_MS = 1500;
export const TENABALL_SLOT_COUNT = 10;

export interface RevealSchedule {
  /** 1-indexed slot ranks visited in order: [10, 9, ..., targetRank] */
  steps: number[];
  /** 0-indexed slot indices visited in order: [9, 8, ..., targetRank - 1] */
  stepIndices: number[];
  /** Duration in ms to dwell on each highlighted step before advancing / revealing */
  stepDurationsMs: number[];
  /** Total duration in ms (sum of stepDurationsMs), guaranteed <= maxTotalMs */
  totalDurationMs: number;
  /** Number of tick sounds to play (always equal to steps.length) */
  tickCount: number;
}

/**
 * Pure function that computes the countdown highlight sequence and ease-out step timings
 * for revealing a TenaBall answer at `targetRank` (1..10).
 *
 * - Rank 10 -> 1 step, very short (~75 ms)
 * - Rank 1  -> 10 steps (10 -> 1), longest (~1380 ms), never exceeding `maxTotalMs` (1500 ms)
 * - Step durations monotonically increase (ease-out deceleration as highlight approaches target)
 * - Tick count is strictly equal to the number of visited steps
 */
export function buildRevealSchedule(
  targetRank: number,
  maxTotalMs: number = MAX_REVEAL_TOTAL_MS
): RevealSchedule {
  const clampedRank = Math.max(1, Math.min(TENABALL_SLOT_COUNT, Math.round(targetRank)));
  const steps: number[] = [];
  for (let r = TENABALL_SLOT_COUNT; r >= clampedRank; r -= 1) {
    steps.push(r);
  }
  const stepIndices = steps.map((r) => r - 1);
  const n = steps.length;

  if (n === 1) {
    const singleMs = Math.min(75, maxTotalMs);
    return {
      steps,
      stepIndices,
      stepDurationsMs: [singleMs],
      totalDurationMs: singleMs,
      tickCount: 1,
    };
  }

  // Scale total target duration monotonically with step count, capped safely below maxTotalMs
  const targetTotalMs = Math.min(maxTotalMs, Math.round(75 + (n - 1) * 145));

  // Ease-out weights: early steps are snappy, later steps decelerate smoothly
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < n; i += 1) {
    const progress = i / (n - 1); // 0..1
    const w = 1 + 1.85 * Math.pow(progress, 1.6);
    weights.push(w);
    weightSum += w;
  }

  const rawDurations = weights.map((w) => Math.max(55, Math.floor((w / weightSum) * targetTotalMs)));

  // Enforce non-decreasing durations (strict ease-out) while keeping total <= maxTotalMs
  for (let i = 1; i < rawDurations.length; i += 1) {
    if (rawDurations[i] < rawDurations[i - 1]) {
      rawDurations[i] = rawDurations[i - 1];
    }
  }

  let total = rawDurations.reduce((acc, d) => acc + d, 0);
  if (total > maxTotalMs) {
    const scale = maxTotalMs / total;
    for (let i = 0; i < rawDurations.length; i += 1) {
      rawDurations[i] = Math.floor(rawDurations[i] * scale);
    }
    total = rawDurations.reduce((acc, d) => acc + d, 0);
  }

  return {
    steps,
    stepIndices,
    stepDurationsMs: rawDurations,
    totalDurationMs: total,
    tickCount: steps.length,
  };
}
