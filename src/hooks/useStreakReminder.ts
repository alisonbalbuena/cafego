import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { UserProfile } from '../types';
import { DAY_MS, parseDateKey } from '../utils/dateHelpers';

const REMINDER_ID = 'weekly-streak-reminder';
// Sunday 5pm of the week after the last studied week — the streak's final hours.
const REMINDER_OFFSET_MS = 7 * DAY_MS + 6 * DAY_MS + 17 * 60 * 60 * 1000;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Schedules a local notification for when the user's weekly study streak is
 * about to break (Sunday evening of the first week without a session), and
 * reschedules it whenever the streak advances. */
export function useStreakReminder(profile: UserProfile | null) {
  const weeklyStreak = profile?.weeklyStreak ?? 0;
  const lastStudyWeekKey = profile?.lastStudyWeekKey;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
        if (weeklyStreak < 1 || !lastStudyWeekKey) return;

        const reminderTs = parseDateKey(lastStudyWeekKey).getTime() + REMINDER_OFFSET_MS;
        if (reminderTs <= Date.now()) return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Streak reminders',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') return;

        await Notifications.scheduleNotificationAsync({
          identifier: REMINDER_ID,
          content: {
            title: '🔥 Your streak is about to break!',
            body: `Your ${weeklyStreak}-week study streak ends tonight — fit in a quick session to keep it alive.`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderTs,
          },
        });
      } catch {
        // Notifications are best-effort — never block the app over them.
      }
    })();
  }, [weeklyStreak, lastStudyWeekKey]);
}
