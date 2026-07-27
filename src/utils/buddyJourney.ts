import { StudySession, UserProfile } from '../types';

/** Progression is earned through consistency (session count), never coins. */
export interface BuddyStage {
  id: string;
  label: string;
  minSessions: number;
  emoji: string;
}

export const BUDDY_STAGES: BuddyStage[] = [
  { id: 'bean', label: 'Tiny Coffee Bean', minSessions: 0, emoji: '🌱' },
  { id: 'latte', label: 'Little Latte', minSessions: 10, emoji: '☕' },
  { id: 'barista', label: 'Barista Buddy', minSessions: 50, emoji: '🧑‍🍳' },
  { id: 'wizard', label: 'Espresso Wizard', minSessions: 150, emoji: '🧙' },
  { id: 'master', label: 'Coffee Master', minSessions: 300, emoji: '👑' },
];

export function getBuddyStage(completedSessionCount: number): BuddyStage {
  let stage = BUDDY_STAGES[0];
  for (const s of BUDDY_STAGES) {
    if (completedSessionCount >= s.minSessions) stage = s;
  }
  return stage;
}

export function getNextBuddyStage(completedSessionCount: number): BuddyStage | null {
  return BUDDY_STAGES.find((s) => s.minSessions > completedSessionCount) ?? null;
}

/** Achievement-earned accessories — a visual scrapbook of a student's habits,
 * never purchasable. Rendered today as an emoji badge in the accessory shelf;
 * swap `emoji` for a `source: require('../../assets/buddies/accessories/…')`
 * once real accessory art exists, without touching the unlock logic below. */
export interface BuddyAccessory {
  id: string;
  label: string;
  emoji: string;
  description: string;
  isUnlocked: (ctx: AccessoryContext) => boolean;
}

export interface AccessoryContext {
  totalStudyHours: number;
  weeklyStreak: number;
  uniqueCafeCount: number;
  allNighterCount: number;
  syncedSessionCount: number;
}

export const BUDDY_ACCESSORIES: BuddyAccessory[] = [
  {
    id: 'tiny_book',
    label: 'Tiny book',
    emoji: '📚',
    description: 'Read 100 study hours',
    isUnlocked: (c) => c.totalStudyHours >= 100,
  },
  {
    id: 'flame_scarf',
    label: 'Flame scarf',
    emoji: '🔥',
    description: '30-day streak',
    isUnlocked: (c) => c.weeklyStreak >= 30,
  },
  {
    id: 'travel_backpack',
    label: 'Travel backpack',
    emoji: '🎒',
    description: 'Studied at 20 unique cafés',
    isUnlocked: (c) => c.uniqueCafeCount >= 20,
  },
  {
    id: 'moon_pajamas',
    label: 'Moon pajamas',
    emoji: '🌙',
    description: 'Completed 10 late-night sessions',
    isUnlocked: (c) => c.allNighterCount >= 10,
  },
  {
    id: 'mini_stopwatch',
    label: 'Mini stopwatch',
    emoji: '⏱️',
    description: 'Hosted 25 synced sessions',
    isUnlocked: (c) => c.syncedSessionCount >= 25,
  },
];

export function getAccessoryContext(profile: UserProfile | null | undefined, sessions: StudySession[]): AccessoryContext {
  const completed = sessions.filter((s) => s.endedAt != null);
  const totalStudyHours = completed.reduce((sum, s) => sum + (s.endedAt! - s.startedAt), 0) / 3600000;
  const uniqueCafeCount = new Set(completed.map((s) => s.cafeId)).size;
  return {
    totalStudyHours,
    weeklyStreak: profile?.weeklyStreak ?? 0,
    uniqueCafeCount,
    allNighterCount: profile?.allNighterCount ?? 0,
    syncedSessionCount: profile?.syncedSessionCount ?? 0,
  };
}

export function getUnlockedAccessories(ctx: AccessoryContext): BuddyAccessory[] {
  return BUDDY_ACCESSORIES.filter((a) => a.isUnlocked(ctx));
}

/** "Coffee Buddy remembers everywhere you've studied" — a quiet, low-noise
 * popup shown right after checking in, only for notable milestones (first
 * cafe ever, first visit to this specific cafe, or a well-loved regular
 * spot) so it doesn't fire on every single check-in. */
export function getLocationAdventureMessage(
  cafeName: string,
  priorVisitsAtThisCafe: number,
  priorDistinctCafeCount: number
): { title: string; message: string } | null {
  if (priorDistinctCafeCount === 0) {
    return {
      title: '🎉 New Adventure!',
      message: `Coffee Buddy's first ever study spot: ${cafeName}!`,
    };
  }
  if (priorVisitsAtThisCafe === 0) {
    return {
      title: `📍 ${cafeName}`,
      message: `Coffee Buddy visited ${cafeName} for the first time!`,
    };
  }
  if (priorVisitsAtThisCafe === 4) {
    return {
      title: `📍 ${cafeName}`,
      message: `Coffee Buddy loves studying here.`,
    };
  }
  return null;
}
