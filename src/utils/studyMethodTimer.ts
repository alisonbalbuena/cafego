import { StudySession, studyMethodMeta } from '../types';

export function getPhaseDurationMs(session: StudySession): number {
  const phase = session.methodPhase ?? 'work';
  if (phase === 'work') return (session.methodWorkMin ?? 0) * 60000;
  if (phase === 'longBreak') {
    const meta = studyMethodMeta(session.studyMethod);
    return (meta.longBreakMin ?? session.methodBreakMin ?? 0) * 60000;
  }
  return (session.methodBreakMin ?? 0) * 60000;
}

export function getPhaseRemainingMs(session: StudySession, now: number): number {
  const effectiveNow = session.pausedAt ?? now;
  const elapsed = effectiveNow - (session.methodPhaseStartedAt ?? effectiveNow);
  return Math.max(0, getPhaseDurationMs(session) - elapsed);
}

/** Total elapsed active (non-paused) time since the session started. */
export function getSessionElapsedMs(session: StudySession, now: number): number {
  const effectiveNow = session.pausedAt ?? now;
  const pausedMs = session.pausedMs ?? 0;
  return Math.max(0, effectiveNow - session.startedAt - pausedMs);
}

export function getSessionTotalRemainingMs(session: StudySession, now: number): number | null {
  if (session.studyMethod !== 'custom' || session.methodTotalMin == null) return null;
  return Math.max(0, session.methodTotalMin * 60000 - getSessionElapsedMs(session, now));
}

/** Returns the Firestore update to apply when the current phase's time is up,
 * or null if no transition is due yet (or the session isn't using a method). */
export function getNextPhaseUpdate(session: StudySession, now: number): Record<string, any> | null {
  if (!session.studyMethod || session.studyMethod === 'none') return null;
  if (session.methodPhase === 'done') return null;
  if (session.pausedAt) return null;

  if (session.studyMethod === 'custom') {
    const totalRemaining = getSessionTotalRemainingMs(session, now);
    if (totalRemaining != null && totalRemaining <= 0) {
      return { methodPhase: 'done' };
    }
  }

  if (getPhaseRemainingMs(session, now) > 0) return null;

  const meta = studyMethodMeta(session.studyMethod);
  const phase = session.methodPhase ?? 'work';
  const round = session.methodRound ?? 1;

  if (phase === 'work') {
    if (session.studyMethod === 'timeboxing') {
      return { methodPhase: 'done' };
    }
    if (session.studyMethod === 'custom' && round > (session.methodBreakCount ?? 0)) {
      // All planned breaks used — keep working in fresh intervals until the total runs out.
      return { methodPhaseStartedAt: now };
    }
    const goesLong = !!meta.roundsBeforeLongBreak && round % meta.roundsBeforeLongBreak === 0;
    return { methodPhase: goesLong ? 'longBreak' : 'break', methodPhaseStartedAt: now };
  }

  return { methodPhase: 'work', methodRound: round + 1, methodPhaseStartedAt: now };
}

const PHASE_LABELS: Record<string, string> = {
  work: 'Focus',
  break: 'Break',
  longBreak: 'Long break',
  done: 'Done',
};

export function getPhaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? 'Focus';
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
