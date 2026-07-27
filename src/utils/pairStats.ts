import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { weekKey } from './dateHelpers';

export interface PairStats {
  uids: string[];
  sessionsThisWeek: number;
  weekKey: string;
  totalSessions: number;
}

export function pairStatsId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

/** Records a successfully-completed synced session between two people. Call
 * from only one side (the alphabetically-first uid) so a mutual completion
 * detected independently by both clients doesn't double-count. */
export async function incrementPairStats(uidA: string, uidB: string): Promise<void> {
  const sorted = [uidA, uidB].sort();
  const ref = doc(db, 'pairStats', pairStatsId(uidA, uidB));
  const snap = await getDoc(ref);
  const thisWeek = weekKey(Date.now());
  if (snap.exists()) {
    const data = snap.data() as PairStats;
    const sessionsThisWeek = data.weekKey === thisWeek ? (data.sessionsThisWeek ?? 0) + 1 : 1;
    await setDoc(ref, {
      uids: sorted,
      sessionsThisWeek,
      weekKey: thisWeek,
      totalSessions: (data.totalSessions ?? 0) + 1,
    });
  } else {
    await setDoc(ref, { uids: sorted, sessionsThisWeek: 1, weekKey: thisWeek, totalSessions: 1 });
  }
}

export async function getPairStats(uidA: string, uidB: string): Promise<PairStats | null> {
  const snap = await getDoc(doc(db, 'pairStats', pairStatsId(uidA, uidB)));
  return snap.exists() ? (snap.data() as PairStats) : null;
}
