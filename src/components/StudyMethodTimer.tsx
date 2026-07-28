import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Vibration, StyleSheet } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { applyShield, removeShield } from 'screen-time';
import { updateStudyTimerActivity } from 'study-timer-activity';
import { StudySession, studyMethodMeta } from '../types';
import {
  formatCountdown,
  getNextPhaseUpdate,
  getPhaseDurationMs,
  getPhaseLabel,
  getPhaseRemainingMs,
  getSessionTotalRemainingMs,
} from '../utils/studyMethodTimer';
import { COLORS, RADIUS, FONTS } from '../theme';

interface Props {
  session: StudySession;
  screenTimeShieldEnabled?: boolean;
}

const PHASE_META: Record<string, { label: string; emoji: string }> = {
  work: { label: 'Focus', emoji: '🎯' },
  break: { label: 'Break', emoji: '☕' },
  longBreak: { label: 'Long break', emoji: '🌿' },
  done: { label: "Time's up", emoji: '✅' },
};

export default function StudyMethodTimer({ session, screenTimeShieldEnabled }: Props) {
  const [now, setNow] = useState(Date.now());
  const transitioningRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    transitioningRef.current = false;
  }, [session.methodPhase, session.methodPhaseStartedAt]);

  useEffect(() => {
    if (transitioningRef.current) return;
    const update = getNextPhaseUpdate(session, now);
    if (!update) return;
    transitioningRef.current = true;
    Vibration.vibrate([0, 400, 200, 400]);
    if (screenTimeShieldEnabled && update.methodPhase) {
      if (update.methodPhase === 'work') {
        applyShield().catch(() => {});
      } else {
        // 'break', 'longBreak', or 'done'
        removeShield().catch(() => {});
      }
    }
    if (session.studyMethod && session.studyMethod !== 'none') {
      const mergedSession = { ...session, ...update };
      const newPhase = mergedSession.methodPhase ?? 'work';
      const isDone = newPhase === 'done';
      const phaseDurationMs = isDone ? 0 : getPhaseDurationMs(mergedSession);
      updateStudyTimerActivity({
        subject: session.subject,
        phaseLabel: getPhaseLabel(newPhase),
        phaseEndDate: now + phaseDurationMs,
        remainingSeconds: Math.round(phaseDurationMs / 1000),
        paused: false,
      }).catch(() => {});
    }
    updateDoc(doc(db, 'studySessions', session.id), update).catch(() => {
      transitioningRef.current = false;
    });
  }, [session, now, screenTimeShieldEnabled]);

  if (!session.studyMethod || session.studyMethod === 'none') return null;

  const meta = studyMethodMeta(session.studyMethod);
  const phase = session.methodPhase ?? 'work';
  const phaseMeta = PHASE_META[phase];
  const remainingMs = getPhaseRemainingMs(session, now);
  const totalRemainingMs = getSessionTotalRemainingMs(session, now);
  const showRound = !!meta.roundsBeforeLongBreak || session.studyMethod === 'custom';

  return (
    <View style={styles.card}>
      <View style={styles.methodLabelRow}>
        {meta.icon ? (
          <Image source={meta.icon} style={styles.methodIcon} resizeMode="contain" />
        ) : null}
        <Text style={styles.methodLabel}>{meta.icon ? meta.label : `${meta.emoji} ${meta.label}`}</Text>
      </View>
      {phase === 'done' ? (
        <Text style={styles.doneText}>✅ Time's up — wrap up or end your session.</Text>
      ) : (
        <>
          <Text style={styles.phaseLabel}>
            {phaseMeta.emoji} {phaseMeta.label}
            {showRound ? ` · Round ${session.methodRound ?? 1}` : ''}
          </Text>
          <Text style={styles.countdown}>{formatCountdown(remainingMs)}</Text>
          {totalRemainingMs != null && (
            <Text style={styles.totalRemaining}>
              ⏳ {formatCountdown(totalRemainingMs)} left in session
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  methodLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  methodIcon: { width: 18, height: 18 },
  methodLabel: { fontSize: 13, fontWeight: '700', color: COLORS.primary, fontFamily: FONTS.semiBold, letterSpacing: 0.5 },
  phaseLabel: { fontSize: 13, color: COLORS.textMuted, marginTop: 6, fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  countdown: { fontSize: 28, fontWeight: '700', color: COLORS.text, marginTop: 4, letterSpacing: 1, fontFamily: FONTS.semiBold },
  totalRemaining: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.2 },
  doneText: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 6, textAlign: 'center', fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
});
