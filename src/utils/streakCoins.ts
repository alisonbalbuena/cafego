import { DAY_MS, weekKey } from './dateHelpers';

// 1 coin every 2 minutes of active studying = 30 coins/hour.
export const COINS_PER_HOUR = 30;
export const WEEKLY_STREAK_MULTIPLIER_STEP = 0.2;
const WEEK_MS = DAY_MS * 7;

export interface StreakCoinResult {
  coins: number;
  newWeeklyStreak: number;
  newLastStudyWeekKey: string;
}

export function getCombinedMultiplier(weeklyStreak: number): number {
  return 1 + Math.max(0, weeklyStreak - 1) * WEEKLY_STREAK_MULTIPLIER_STEP;
}

/** Computes coins earned for a study span, updating the weekly streak based
 * on whether this week continues, breaks, or is a fresh start relative to the
 * last week the user studied. The streak only advances once per calendar week. */
export function computeStreakCoins(
  activeMs: number,
  endedAt: number,
  currentWeeklyStreak: number,
  lastStudyWeekKey: string | undefined
): StreakCoinResult {
  const thisWeekKey = weekKey(endedAt);
  const lastWeekKey = weekKey(endedAt - WEEK_MS);

  let newWeeklyStreak: number;
  if (lastStudyWeekKey === thisWeekKey) {
    newWeeklyStreak = currentWeeklyStreak || 1;
  } else if (lastStudyWeekKey === lastWeekKey) {
    newWeeklyStreak = (currentWeeklyStreak || 0) + 1;
  } else {
    newWeeklyStreak = 1;
  }

  const multiplier = getCombinedMultiplier(newWeeklyStreak);
  const baseCoins = (activeMs / (60 * 60 * 1000)) * COINS_PER_HOUR;
  const coins = Math.round(baseCoins * multiplier * 100) / 100;

  return {
    coins,
    newWeeklyStreak,
    newLastStudyWeekKey: thisWeekKey,
  };
}
