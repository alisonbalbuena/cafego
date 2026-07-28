import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { StudySession } from '../types';
import { DAY_MS, startOfWeek } from '../utils/dateHelpers';
import { formatDuration } from '../utils/format';
import { COLORS, RADIUS, FONTS } from '../theme';
import { UI_ICONS } from '../data/uiIcons';

function sessionActiveMs(s: StudySession): number {
  if (s.endedAt == null) return 0;
  return Math.max(0, s.endedAt - s.startedAt - (s.pausedMs ?? 0));
}

export default function WeeklyRecapCard() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<StudySession[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'studySessions'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession));
    });
    return unsubscribe;
  }, [user]);

  const recap = useMemo(() => {
    const thisWeekStart = startOfWeek(Date.now());
    const lastWeekStart = thisWeekStart - 7 * DAY_MS;
    let thisWeekMs = 0;
    let thisWeekCount = 0;
    let lastWeekMs = 0;
    sessions.forEach((s) => {
      if (s.endedAt == null || s.archived) return;
      if (s.startedAt >= thisWeekStart) {
        thisWeekMs += sessionActiveMs(s);
        thisWeekCount += 1;
      } else if (s.startedAt >= lastWeekStart) {
        lastWeekMs += sessionActiveMs(s);
      }
    });
    return { thisWeekMs, thisWeekCount, lastWeekMs };
  }, [sessions]);

  const weeklyStreak = profile?.weeklyStreak ?? 0;
  const deltaMs = recap.thisWeekMs - recap.lastWeekMs;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Image source={UI_ICONS.thisWeek} style={styles.titleIcon} resizeMode="contain" />
        <Text style={styles.title}>This week</Text>
      </View>
      {recap.thisWeekCount === 0 ? (
        <Text style={styles.emptyText}>
          No sessions yet this week — start one to keep your stats moving.
        </Text>
      ) : (
        <Text style={styles.summary}>
          {formatDuration(recap.thisWeekMs)} across {recap.thisWeekCount} session
          {recap.thisWeekCount === 1 ? '' : 's'}
        </Text>
      )}
      <View style={styles.metaRow}>
        {weeklyStreak > 0 && (
          <View style={styles.streakMeta}>
            <Image source={UI_ICONS.streak} style={styles.streakMetaIcon} resizeMode="contain" />
            <Text style={styles.metaText}>{weeklyStreak}-week streak</Text>
          </View>
        )}
        {recap.lastWeekMs > 0 && (
          <Text style={styles.metaText}>
            {deltaMs >= 0 ? '📈' : '📉'} {formatDuration(Math.abs(deltaMs))}{' '}
            {deltaMs >= 0 ? 'more' : 'less'} than last week
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleIcon: { width: 16, height: 16 },
  title: { fontSize: 13, fontWeight: '700', color: COLORS.primary, fontFamily: FONTS.semiBold, letterSpacing: 0.5 },
  summary: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 6, fontFamily: FONTS.semiBold, letterSpacing: 0.8 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, marginTop: 6, fontFamily: FONTS.regular, letterSpacing: 0.4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  metaText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, fontFamily: FONTS.semiBold, letterSpacing: 0.3 },
  streakMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakMetaIcon: { width: 14, height: 14 },
});
