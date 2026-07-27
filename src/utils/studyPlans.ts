import { arrayUnion, doc, increment, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { StudyPlan, StudySession } from '../types';
import { DAY_MS, dateKey, parseDateKey } from './dateHelpers';

export function getStudiedMinutesByDate(sessions: StudySession[]): Record<string, number> {
  const map: Record<string, number> = {};
  sessions.forEach((s) => {
    if (s.endedAt == null) return;
    const key = dateKey(s.startedAt);
    const activeMs = Math.max(0, s.endedAt - s.startedAt - (s.pausedMs ?? 0));
    map[key] = (map[key] ?? 0) + activeMs / 60000;
  });
  return map;
}

export function getMinutesByMemberAndDate(
  sessions: StudySession[]
): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  sessions.forEach((s) => {
    if (s.endedAt == null) return;
    const day = dateKey(s.startedAt);
    const activeMs = Math.max(0, s.endedAt - s.startedAt - (s.pausedMs ?? 0));
    if (!map[s.uid]) map[s.uid] = {};
    map[s.uid][day] = (map[s.uid][day] ?? 0) + activeMs / 60000;
  });
  return map;
}

export function getPlanDateKeys(plan: StudyPlan): string[] {
  const keys: string[] = [];
  let t = parseDateKey(plan.startDateKey).getTime();
  const endTime = parseDateKey(plan.endDateKey).getTime();
  while (t <= endTime) {
    keys.push(dateKey(t));
    t += DAY_MS;
  }
  return keys;
}

export function isPlanOver(plan: StudyPlan): boolean {
  return dateKey(Date.now()) > plan.endDateKey;
}

export function isPlanFlawless(plan: StudyPlan): boolean {
  if (!isPlanOver(plan)) return false;
  const allDates = getPlanDateKeys(plan);
  return plan.memberUids.every((uid) => {
    const missed = plan.missedDays?.[uid] ?? 0;
    const processed = plan.processedDays?.[uid] ?? [];
    return missed === 0 && allDates.every((d) => processed.includes(d));
  });
}

/** Self-evaluates every not-yet-processed, fully-elapsed day in the plan for
 * one member using their own sessions, awarding/penalizing their own coins
 * and recording the outcome on the shared plan doc. Idempotent — re-running
 * on already-processed days is a no-op. Every member must run this on their
 * own device (no backend to do it centrally), so progress only updates when
 * that person's app is open. */
export async function evaluateMyProgress(
  plan: StudyPlan,
  myUid: string,
  mySessions: StudySession[]
): Promise<{ coinsDelta: number; penalized: boolean }> {
  const today = dateKey(Date.now());
  const minutesByDate = getStudiedMinutesByDate(mySessions);
  const processed = new Set(plan.processedDays?.[myUid] ?? []);
  let missed = plan.missedDays?.[myUid] ?? 0;
  let coinsDelta = 0;
  let penalized = false;
  const newlyProcessed: string[] = [];
  const alreadyPenalized = (plan.penalizedUids ?? []).includes(myUid);

  for (const d of getPlanDateKeys(plan)) {
    if (d >= today) break;
    if (processed.has(d)) continue;
    const minutes = minutesByDate[d] ?? 0;
    if (minutes >= plan.dailyMinMinutes) {
      coinsDelta += plan.dailyBonusCoins;
    } else {
      missed += 1;
      if (missed === plan.missThreshold + 1 && !alreadyPenalized && !penalized) {
        coinsDelta -= plan.penaltyCoins;
        penalized = true;
      }
    }
    newlyProcessed.push(d);
  }

  if (newlyProcessed.length === 0) return { coinsDelta: 0, penalized: false };

  if (coinsDelta !== 0) {
    await updateDoc(doc(db, 'users', myUid), { petCoins: increment(coinsDelta) });
  }
  await updateDoc(doc(db, 'studyPlans', plan.id), {
    [`processedDays.${myUid}`]: arrayUnion(...newlyProcessed),
    [`missedDays.${myUid}`]: missed,
    ...(penalized ? { penalizedUids: arrayUnion(myUid) } : {}),
  });

  return { coinsDelta, penalized };
}

/** Claims the group's flawless-completion reward for one member, if the plan
 * has ended, everyone hit every day, and this member hasn't claimed yet. */
export async function claimGroupRewardIfEligible(plan: StudyPlan, myUid: string): Promise<boolean> {
  if (plan.groupRewardClaimedBy?.includes(myUid)) return false;
  if (!isPlanFlawless(plan)) return false;
  await updateDoc(doc(db, 'studyPlans', plan.id), {
    groupRewardClaimedBy: arrayUnion(myUid),
  });
  await updateDoc(doc(db, 'users', myUid), {
    petCoins: increment(plan.groupRewardCoins),
    unlockedCoffeeFriends: arrayUnion('special_lattamily'),
  });
  return true;
}
