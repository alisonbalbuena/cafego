import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONTS } from '../theme';
import { dateKey, parseDateKey } from '../utils/dateHelpers';
import { formatDuration, formatMoney, formatTime } from '../utils/format';
import { getSessionSubjectSegments, StudySession } from '../types';

interface Props {
  sessions: StudySession[];
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function StudyCalendar({ sessions }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const sessionsByDay = useMemo(() => {
    const map: Record<string, StudySession[]> = {};
    sessions.forEach((s) => {
      const key = dateKey(s.startedAt);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessions]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewYear, viewMonth]);

  const goPrev = () => {
    setSelectedKey(null);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    setSelectedKey(null);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const todayKey = dateKey(today.getTime());
  const selectedSessions = selectedKey ? sessionsByDay[selectedKey] ?? [] : [];

  const subjectSegments = useMemo(() => {
    const segments: { subject: string; startedAt: number; endedAt: number }[] = [];
    selectedSessions.forEach((s) => {
      if (s.endedAt == null) return;
      getSessionSubjectSegments(s).forEach((seg) => {
        const end = seg.endedAt ?? s.endedAt!;
        if (end > seg.startedAt) {
          segments.push({ subject: seg.subject, startedAt: seg.startedAt, endedAt: end });
        }
      });
    });
    return segments.sort((a, b) => a.startedAt - b.startedAt);
  }, [selectedSessions]);

  return (
    <View>
      <View style={styles.headerRow}>
        <Pressable onPress={goPrev} hitSlop={10} style={styles.navButton}>
          <Ionicons name="chevron-back" size={18} color={COLORS.textMuted} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={goNext} hitSlop={10} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekdayText}>
            {w}
          </Text>
        ))}
      </View>

      {weeks.map((row, ri) => (
        <View key={ri} style={styles.weekRow}>
          {row.map((date, ci) => {
            if (!date) return <View key={ci} style={styles.dayCell} />;
            const key = dateKey(date.getTime());
            const daySessions = sessionsByDay[key];
            const hasSession = !!daySessions?.length;
            const spend = (daySessions ?? []).reduce((sum, s) => sum + (s.amountSpent ?? 0), 0);
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <Pressable
                key={ci}
                style={[
                  styles.dayCell,
                  isToday && styles.dayCellToday,
                  isSelected && styles.dayCellSelected,
                ]}
                onPress={() => hasSession && setSelectedKey(isSelected ? null : key)}
              >
                <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
                  {date.getDate()}
                </Text>
                {hasSession && <View style={[styles.dot, spend > 0 && styles.dotSpend]} />}
              </Pressable>
            );
          })}
        </View>
      ))}

      {selectedKey && selectedSessions.length > 0 && (
        <View style={styles.detailCard}>
          <Text style={styles.detailDate}>
            {parseDateKey(selectedKey).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          {selectedSessions.map((s) => (
            <View key={s.id} style={styles.detailRow}>
              <Text style={styles.detailCafe}>{s.cafeName}</Text>
              <Text style={styles.detailMeta}>
                {s.subject}
                {s.amountSpent ? ` · ${formatMoney(s.amountSpent)}` : ''}
              </Text>
            </View>
          ))}

          {subjectSegments.length > 0 && (
            <View style={styles.subjectSection}>
              <Text style={styles.subjectTitle}>📚 Time by subject</Text>
              {subjectSegments.map((seg, i) => (
                <View key={i} style={styles.subjectRow}>
                  <Text style={styles.subjectName}>{seg.subject}</Text>
                  <Text style={styles.subjectMeta}>
                    {formatTime(seg.startedAt)} – {formatTime(seg.endedAt)} ·{' '}
                    {formatDuration(seg.endedAt - seg.startedAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navButton: { padding: 4 },
  monthLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  weekRow: { flexDirection: 'row' },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textFaint,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: FONTS.semiBold,
  },
  dayCell: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    marginBottom: 2,
  },
  dayCellToday: { borderWidth: 1.5, borderColor: COLORS.primary },
  dayCellSelected: { backgroundColor: COLORS.accentLight },
  dayNumber: { fontSize: 13, color: COLORS.text, fontFamily: FONTS.regular },
  dayNumberToday: { fontWeight: '700', color: COLORS.primary, fontFamily: FONTS.semiBold },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.success,
    position: 'absolute',
    bottom: 4,
  },
  dotSpend: { backgroundColor: COLORS.accent },
  detailCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 12,
    marginTop: 10,
  },
  detailDate: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6, fontFamily: FONTS.semiBold, letterSpacing: 0.5 },
  detailRow: { paddingVertical: 4 },
  detailCafe: { fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  detailMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  subjectSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  subjectTitle: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  subjectRow: { paddingVertical: 4 },
  subjectName: { fontSize: 12, fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.3 },
  subjectMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1, fontFamily: FONTS.regular, letterSpacing: 0.2 },
});
