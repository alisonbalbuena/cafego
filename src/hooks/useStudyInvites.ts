import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { db } from '../firebase/config';
import { StudyInvite } from '../types';

/** Live "study with me" invites (sent + received) for a user, plus a 15-
 * minute-ahead local reminder for any accepted, upcoming invite. Call once
 * near the app root (reminders) and again wherever the list is displayed. */
export function useStudyInvites(uid: string | undefined): {
  received: StudyInvite[];
  sent: StudyInvite[];
} {
  const [received, setReceived] = useState<StudyInvite[]>([]);
  const [sent, setSent] = useState<StudyInvite[]>([]);

  useEffect(() => {
    if (!uid) {
      setReceived([]);
      return;
    }
    const q = query(collection(db, 'studyInvites'), where('toUid', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReceived(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as StudyInvite));
    });
    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setSent([]);
      return;
    }
    const q = query(collection(db, 'studyInvites'), where('fromUid', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSent(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as StudyInvite));
    });
    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    if (!uid || Platform.OS === 'web') return;
    (async () => {
      const accepted = [...received, ...sent].filter(
        (i) => i.status === 'accepted' && i.scheduledAt > Date.now()
      );
      for (const invite of accepted) {
        const identifier = `study-invite-${invite.id}`;
        await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
        const remindAt = new Date(invite.scheduledAt - 15 * 60000);
        if (remindAt.getTime() <= Date.now()) continue;
        const otherName = invite.fromUid === uid ? invite.toName : invite.fromName;
        try {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Study invite reminders',
              importance: Notifications.AndroidImportance.DEFAULT,
            });
          }
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') continue;
          await Notifications.scheduleNotificationAsync({
            identifier,
            content: {
              title: '📅 Study session starting soon',
              body: `You're studying with ${otherName} in 15 minutes${
                invite.subject ? ` — ${invite.subject}` : ''
              }.`,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remindAt },
          });
        } catch {
          // Best-effort reminder — never block on this.
        }
      }
    })();
  }, [uid, received, sent]);

  return { received, sent };
}
