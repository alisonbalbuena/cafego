import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { db } from '../firebase/config';
import { StudyPlan, StudySession } from '../types';
import { dateKey } from '../utils/dateHelpers';
import {
  claimGroupRewardIfEligible,
  evaluateMyProgress,
  getStudiedMinutesByDate,
} from '../utils/studyPlans';

/** Live list of study plans the user belongs to. Also self-evaluates past
 * days (coins/misses) and schedules a same-day reminder for any plan whose
 * daily goal isn't met yet — call once near the app root so this runs
 * regardless of which screen is open, and again wherever the list needs to
 * be displayed (Firestore listeners are cheap to duplicate). */
export function useStudyPlans(uid: string | undefined): { plans: StudyPlan[] } {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [mySessions, setMySessions] = useState<StudySession[]>([]);

  useEffect(() => {
    if (!uid) {
      setPlans([]);
      return;
    }
    const q = query(collection(db, 'studyPlans'), where('memberUids', 'array-contains', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlans(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as StudyPlan));
    });
    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setMySessions([]);
      return;
    }
    const q = query(collection(db, 'studySessions'), where('uid', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMySessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession));
    });
    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    if (!uid || plans.length === 0) return;
    plans.forEach(async (plan) => {
      await evaluateMyProgress(plan, uid, mySessions);
      await claimGroupRewardIfEligible(plan, uid);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, plans, mySessions]);

  useEffect(() => {
    if (!uid || Platform.OS === 'web' || plans.length === 0) return;
    (async () => {
      const today = dateKey(Date.now());
      const minutesByDate = getStudiedMinutesByDate(mySessions);
      const todaysMinutes = minutesByDate[today] ?? 0;

      for (const plan of plans) {
        const identifier = `study-plan-${plan.id}`;
        await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
        if (today > plan.endDateKey || today < plan.startDateKey) continue;
        if (todaysMinutes >= plan.dailyMinMinutes) continue;

        const remindAt = new Date();
        remindAt.setHours(19, 0, 0, 0);
        if (remindAt.getTime() <= Date.now()) continue;

        try {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Study plan reminders',
              importance: Notifications.AndroidImportance.DEFAULT,
            });
          }
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') continue;
          await Notifications.scheduleNotificationAsync({
            identifier,
            content: {
              title: `📋 ${plan.name}`,
              body: `You haven't hit today's ${plan.dailyMinMinutes}-minute goal yet — your group is counting on you!`,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remindAt },
          });
        } catch {
          // Best-effort reminder — never block on this.
        }
      }
    })();
  }, [uid, plans, mySessions]);

  return { plans };
}
