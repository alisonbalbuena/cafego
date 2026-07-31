import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { StudySession } from '../types';
import { COLORS, RADIUS, FONTS } from '../theme';
import { formatDuration, formatMoney } from '../utils/format';
import { DAY_MS, startOfMonth, startOfWeek, startOfYear } from '../utils/dateHelpers';
import BarChart from './BarChart';

type Period = 'week' | 'month' | 'year';

const PERIOD_LABELS: Record<Period, string> = { week: 'Week', month: 'Month', year: 'Year' };
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
  /** Whose spending to show — defaults to the signed-in user's own. Pass a
   * friend's uid to reuse this on a read-only FriendProfileScreen. */
  uid?: string;
}

export default function SpendingSection({ uid }: Props) {
  const { user } = useAuth();
  const targetUid = uid ?? user?.uid;
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [period, setPeriod] = useState<Period>('week');

  useEffect(() => {
    if (!targetUid) return;
    const q = query(collection(db, 'studySessions'), where('uid', '==', targetUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsubscribe;
  }, [targetUid]);

  const completed = useMemo(() => sessions.filter((s) => s.endedAt != null), [sessions]);

  const now = Date.now();

  const periodStats = useMemo(() => {
    const rangeStart =
      period === 'week' ? startOfWeek(now) : period === 'month' ? startOfMonth(now) : startOfYear(now);
    const inRange = completed.filter((s) => s.startedAt >= rangeStart);
    const totalMs = inRange.reduce((sum, s) => sum + (s.endedAt! - s.startedAt), 0);
    const totalSpend = inRange.reduce((sum, s) => sum + (s.amountSpent ?? 0), 0);
    return { totalMs, totalSpend };
  }, [completed, period, now]);

  const chartData = useMemo(() => {
    const spendBetween = (start: number, end: number) =>
      completed
        .filter((s) => s.startedAt >= start && s.startedAt < end)
        .reduce((sum, s) => sum + (s.amountSpent ?? 0), 0);

    if (period === 'week') {
      const start = startOfWeek(now);
      return WEEKDAY_LABELS.map((label, i) => ({
        label,
        value: spendBetween(start + i * DAY_MS, start + (i + 1) * DAY_MS),
      }));
    }
    if (period === 'month') {
      const start = startOfMonth(now);
      const d = new Date(now);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const weeksCount = Math.ceil(daysInMonth / 7);
      return Array.from({ length: weeksCount }, (_, i) => ({
        label: `W${i + 1}`,
        value: spendBetween(start + i * 7 * DAY_MS, start + (i + 1) * 7 * DAY_MS),
      }));
    }
    const year = new Date(now).getFullYear();
    return MONTH_LABELS.map((label, i) => ({
      label,
      value: spendBetween(new Date(year, i, 1).getTime(), new Date(year, i + 1, 1).getTime()),
    }));
  }, [completed, period, now]);

  return (
    <View>
      <View style={styles.periodToggle}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <Pressable
            key={p}
            style={[styles.periodChip, period === p && styles.periodChipSelected]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodChipText, period === p && styles.periodChipTextSelected]}>
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatDuration(periodStats.totalMs)}</Text>
          <Text style={styles.statLabel}>Time studied</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatMoney(periodStats.totalSpend)}</Text>
          <Text style={styles.statLabel}>Spent</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.chartTitle}>Spending breakdown</Text>
        <BarChart data={chartData} formatValue={(v) => `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
  },
  chartTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 10, fontFamily: FONTS.semiBold, letterSpacing: 0.5 },
  periodToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  periodChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  periodChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  periodChipTextSelected: { color: COLORS.white },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.7 },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontFamily: FONTS.regular, letterSpacing: 0.3 },
});
