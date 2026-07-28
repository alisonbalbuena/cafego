import React, { useMemo } from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useStudyPlans } from '../hooks/useStudyPlans';
import { isPlanOver, isPlanFlawless } from '../utils/studyPlans';
import { dateKey } from '../utils/dateHelpers';
import { COLORS, RADIUS, FONTS } from '../theme';
import BackButton from '../components/BackButton';
import { UI_ICONS } from '../data/uiIcons';

export default function StudyPlansScreen({ navigation }: any) {
  const { user } = useAuth();
  const { plans } = useStudyPlans(user?.uid);

  const { active, past } = useMemo(() => {
    const today = dateKey(Date.now());
    const activePlans = plans
      .filter((p) => p.endDateKey >= today)
      .sort((a, b) => a.endDateKey.localeCompare(b.endDateKey));
    const pastPlans = plans
      .filter((p) => p.endDateKey < today)
      .sort((a, b) => b.endDateKey.localeCompare(a.endDateKey));
    return { active: activePlans, past: pastPlans };
  }, [plans]);

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <BackButton navigation={navigation} />
        <Image source={UI_ICONS.studyPlans} style={styles.headingIcon} resizeMode="contain" />
        <Text style={styles.heading}>Study plans</Text>
      </View>

      <Pressable
        style={styles.newButton}
        onPress={() => navigation.navigate('CreateStudyPlan')}
      >
        <Text style={styles.newButtonText}>+ New study plan</Text>
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.sectionTitle}>Active</Text>
        {active.length === 0 ? (
          <Text style={styles.emptyText}>
            No active plans — start one with friends to hold each other accountable.
          </Text>
        ) : (
          active.map((plan) => {
            const daysLeft = Math.max(
              0,
              Math.round(
                (new Date(plan.endDateKey).getTime() - new Date(dateKey(Date.now())).getTime()) /
                  86400000
              ) + 1
            );
            return (
              <Pressable
                key={plan.id}
                style={styles.planCard}
                onPress={() => navigation.navigate('StudyPlanDetail', { planId: plan.id })}
              >
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planMeta}>
                  {plan.subject} · {plan.memberUids.length} member
                  {plan.memberUids.length === 1 ? '' : 's'}
                </Text>
                <Text style={styles.planMeta}>
                  {daysLeft} day{daysLeft === 1 ? '' : 's'} left · {plan.dailyMinMinutes} min/day goal
                </Text>
              </Pressable>
            );
          })
        )}

        {past.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Past</Text>
            {past.map((plan) => {
              const flawless = isPlanOver(plan) && isPlanFlawless(plan);
              return (
                <Pressable
                  key={plan.id}
                  style={styles.planCard}
                  onPress={() => navigation.navigate('StudyPlanDetail', { planId: plan.id })}
                >
                  <Text style={styles.planName}>
                    {flawless ? '🏆 ' : ''}
                    {plan.name}
                  </Text>
                  <Text style={styles.planMeta}>
                    {plan.subject} · {flawless ? 'Completed flawlessly!' : 'Ended'}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', flexShrink: 1, fontFamily: FONTS.bold, letterSpacing: 1.0 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  headingIcon: { width: 26, height: 26 },
  newButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  newButtonText: { color: '#fff', fontWeight: '600', fontSize: 15, fontFamily: FONTS.semiBold, letterSpacing: 0.5 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 8,
    marginTop: 8,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.6,
  },
  emptyText: { color: COLORS.textFaint, marginBottom: 12, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  planCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
  },
  planName: { fontSize: 15, fontWeight: '700', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  planMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontFamily: FONTS.regular, letterSpacing: 0.3 },
});
