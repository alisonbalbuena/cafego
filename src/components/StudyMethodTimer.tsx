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
import MugTimerDisplay from './MugTimerDisplay';

interface Props {
  /** This device's own session — used for subject/uid and anything not
   * shared with a sync partner. */
  session: StudySession;
  screenTimeShieldEnabled?: boolean;
  /** For synced sessions: the *host's* session (whoever started first).
   * Phase/pause/round/duration are all read from here instead of `session`,
   * and the phase-transition write targets this session's id — so both
   * partners' timers, shield locks, and Live Activities stay on one shared
   * clock instead of drifting independently. Omit (or pass `session` itself)
   * when not synced. */
  timingSession?: StudySession;
}

const PHASE_META: Record<string, { label: string; emoji: string }> = {
  work: { label: 'Studying', emoji: '' },
  break: { label: 'Break', emoji: '☕' },
  longBreak: { label: 'Long break', emoji: '🌿' },
  done: { label: "Time's up", emoji: '✅' },
};

export default function StudyMethodTimer({ session, screenTimeShieldEnabled, timingSession }: Props) {
  const timing = timingSession ?? session;
  const [now, setNow] = useState(Date.now());
  const transitioningRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    transitioningRef.current = false;
  }, [timing.methodPhase, timing.methodPhaseStartedAt]);

  useEffect(() => {
    if (transitioningRef.current) return;
    const update = getNextPhaseUpdate(timing, now);
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
      const mergedTiming = { ...timing, ...update };
      const newPhase = mergedTiming.methodPhase ?? 'work';
      const isDone = newPhase === 'done';
      const phaseDurationMs = isDone ? 0 : getPhaseDurationMs(mergedTiming);
      updateStudyTimerActivity({
        subject: session.subject,
        phaseLabel: getPhaseLabel(newPhase),
        phaseEndDate: now + phaseDurationMs,
        remainingSeconds: Math.round(phaseDurationMs / 1000),
        paused: false,
      }).catch(() => {});
    }
    // The timing session's doc (the host's, when synced) — both partners'
    // timers compute this identically off the same shared data, so writing
    // from either device is redundant-but-harmless rather than a conflict.
    updateDoc(doc(db, 'studySessions', timing.id), update).catch(() => {
      transitioningRef.current = false;
    });
    // Mirror onto this device's own doc too when it's not the same one — if
    // the joiner's own doc never got the phase/round updates, they'd jump
    // backward to whatever was frozen at check-in the moment sync ends
    // (partner leaves early, etc). Keeping both docs current the whole time
    // means desyncing is just a no-op for continuity.
    if (session.id !== timing.id) {
      updateDoc(doc(db, 'studySessions', session.id), update).catch(() => {});
    }
  }, [timing, now, screenTimeShieldEnabled, session.id, session.studyMethod, session.subject]);

  if (!timing.studyMethod || timing.studyMethod === 'none') return null;

  const meta = studyMethodMeta(timing.studyMethod);
  const phase = timing.methodPhase ?? 'work';
  const phaseMeta = PHASE_META[phase];
  const remainingMs = getPhaseRemainingMs(timing, now);
  const totalRemainingMs = getSessionTotalRemainingMs(timing, now);
  const showRound = !!meta.roundsBeforeLongBreak || timing.studyMethod === 'custom';

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
            {phaseMeta.emoji ? `${phaseMeta.emoji} ` : ''}
            {phaseMeta.label}
            {showRound ? ` · Round ${timing.methodRound ?? 1}` : ''}
          </Text>
          <MugTimerDisplay label={formatCountdown(remainingMs)} paused={!!timing.pausedAt} />
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
  totalRemaining: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.2 },
  doneText: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 6, textAlign: 'center', fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
});
