import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { StudySession } from '../types';
import { COLORS, RADIUS } from '../theme';
import { computeWeekStreak } from '../utils/dateHelpers';
import { UI_ICONS } from '../data/uiIcons';
import StudyCalendar from './StudyCalendar';

export default function StudyCalendarSection() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<StudySession[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'studySessions'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsubscribe;
  }, [user]);

  const streak = useMemo(() => computeWeekStreak(sessions.map((s) => s.startedAt)), [sessions]);

  return (
    <View>
      <View style={styles.streakRow}>
        <Image source={UI_ICONS.streak} style={styles.streakIcon} resizeMode="contain" />
        <Text style={styles.streakText}>
          {streak > 0
            ? `${streak} week streak — keep it going!`
            : 'No streak yet — go study to start one!'}
        </Text>
      </View>

      <View style={styles.card}>
        <StudyCalendar sessions={sessions} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  streakIcon: { width: 22, height: 22 },
  streakText: { fontSize: 13, fontWeight: '600', color: COLORS.primary, flex: 1 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
  },
});
