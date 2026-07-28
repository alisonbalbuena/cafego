import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { StudyPlan, StudySession } from '../types';
import {
  getMinutesByMemberAndDate,
  getPlanDateKeys,
  isPlanFlawless,
  isPlanOver,
} from '../utils/studyPlans';
import { dateKey, parseDateKey } from '../utils/dateHelpers';
import { COLORS, RADIUS, FONTS } from '../theme';
import BackButton from '../components/BackButton';

export default function StudyPlanDetailScreen({ route, navigation }: any) {
  const { planId } = route.params;
  const { user } = useAuth();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'studyPlans', planId), (snap) => {
      setPlan(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as StudyPlan) : null);
    });
    return unsubscribe;
  }, [planId]);

  useEffect(() => {
    if (!plan) return;
    const uids = plan.memberUids.slice(0, 30);
    const q = query(collection(db, 'studySessions'), where('uid', 'in', uids));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession));
    });
    return unsubscribe;
  }, [plan?.memberUids.join(',')]);

  const minutesByMemberAndDate = useMemo(() => getMinutesByMemberAndDate(sessions), [sessions]);
  const dateKeys = useMemo(() => (plan ? getPlanDateKeys(plan) : []), [plan]);
  const today = dateKey(Date.now());

  if (!plan) {
    return (
      <View style={styles.container}>
        <View style={styles.headingRow}>
          <BackButton navigation={navigation} />
          <Text style={styles.heading}>Study plan</Text>
        </View>
        <Text style={styles.emptyText}>Loading…</Text>
      </View>
    );
  }

  const planOver = isPlanOver(plan);
  const flawless = planOver && isPlanFlawless(plan);
  const totalMisses = plan.memberUids.reduce((sum, uid) => sum + (plan.missedDays?.[uid] ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <BackButton navigation={navigation} />
        <Text style={styles.heading}>{plan.name}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.infoCard}>
          <Text style={styles.infoSubject}>{plan.subject}</Text>
          <Text style={styles.infoMeta}>
            {parseDateKey(plan.startDateKey).toLocaleDateString()} –{' '}
            {parseDateKey(plan.endDateKey).toLocaleDateString()} · {plan.dailyMinMinutes} min/day
          </Text>
          <Text style={styles.infoMeta}>
            Lose coins after missing more than {plan.missThreshold} day
            {plan.missThreshold === 1 ? '' : 's'}
          </Text>
        </View>

        {flawless ? (
          <View style={styles.rewardCard}>
            <Text style={styles.rewardText}>
              🏆 Flawless! Everyone in the group unlocked the Lattamily reward.
            </Text>
          </View>
        ) : planOver ? (
          <View style={styles.rewardCard}>
            <Text style={styles.rewardText}>
              Plan ended with {totalMisses} missed day{totalMisses === 1 ? '' : 's'} across the
              group.
            </Text>
          </View>
        ) : (
          <View style={styles.rewardCard}>
            <Text style={styles.rewardText}>
              {totalMisses === 0
                ? '✨ Zero misses so far — keep it up to unlock the group reward!'
                : `${totalMisses} missed day${totalMisses === 1 ? '' : 's'} across the group so far.`}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Daily progress</Text>
        {plan.memberUids.map((uid) => {
          const name = plan.memberNames[uid] ?? 'Someone';
          const memberMinutes = minutesByMemberAndDate[uid] ?? {};
          return (
            <View key={uid} style={styles.memberRow}>
              <Text style={styles.memberName}>
                {uid === user?.uid ? 'You' : name}
                {(plan.missedDays?.[uid] ?? 0) > 0 ? ` · ${plan.missedDays![uid]} missed` : ''}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.dayRow}>
                  {dateKeys.map((d) => {
                    const minutes = memberMinutes[d] ?? 0;
                    const met = minutes >= plan.dailyMinMinutes;
                    let symbol = '·';
                    let cellStyle = styles.dayCellPending;
                    if (d < today) {
                      symbol = met ? '✅' : '❌';
                      cellStyle = met ? styles.dayCellMet : styles.dayCellMissed;
                    } else if (d === today) {
                      symbol = met ? '✅' : '⏳';
                      cellStyle = met ? styles.dayCellMet : styles.dayCellToday;
                    }
                    return (
                      <View key={d} style={[styles.dayCell, cellStyle]}>
                        <Text style={styles.dayCellText}>{symbol}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', flexShrink: 1, fontFamily: FONTS.bold, letterSpacing: 1.0 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  emptyText: { color: COLORS.textFaint, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
  },
  infoSubject: { fontSize: 16, fontWeight: '700', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  infoMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  rewardCard: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 20,
  },
  rewardText: { fontSize: 13, fontWeight: '600', color: COLORS.primary, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  memberRow: { marginBottom: 16 },
  memberName: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  dayRow: { flexDirection: 'row', gap: 6 },
  dayCell: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellPending: { backgroundColor: COLORS.card },
  dayCellMet: { backgroundColor: COLORS.accentLight },
  dayCellMissed: { backgroundColor: COLORS.borderLight },
  dayCellToday: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.primary },
  dayCellText: { fontSize: 14, fontFamily: FONTS.regular },
});
