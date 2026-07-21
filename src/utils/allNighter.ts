const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const OVERNIGHT_WINDOW_START_HOUR = 0; // midnight
const OVERNIGHT_WINDOW_END_HOUR = 6; // 6am
export const ALL_NIGHTER_THRESHOLD_MS = 3 * HOUR_MS;

/** Total time a [startedAt, endedAt] span overlaps any midnight-6am window it crosses. */
export function getOvernightOverlapMs(startedAt: number, endedAt: number): number {
  let total = 0;
  const firstDay = new Date(startedAt);
  firstDay.setHours(0, 0, 0, 0);
  for (let dayStart = firstDay.getTime() - DAY_MS; dayStart <= endedAt; dayStart += DAY_MS) {
    const windowStart = dayStart + OVERNIGHT_WINDOW_START_HOUR * HOUR_MS;
    const windowEnd = dayStart + OVERNIGHT_WINDOW_END_HOUR * HOUR_MS;
    const overlapStart = Math.max(startedAt, windowStart);
    const overlapEnd = Math.min(endedAt, windowEnd);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
}

export function isAllNighter(startedAt: number, endedAt: number): boolean {
  return getOvernightOverlapMs(startedAt, endedAt) >= ALL_NIGHTER_THRESHOLD_MS;
}

export interface AllNighterTitle {
  emoji: string;
  label: string;
}

export function getAllNighterTitle(count: number): AllNighterTitle | null {
  if (count <= 0) return null;
  if (count < 5) return { emoji: '🌙', label: 'All-nighter' };
  return { emoji: '🦉', label: 'Night Owl' };
}
