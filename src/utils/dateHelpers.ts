export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const day = d.getDay();
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function startOfYear(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), 0, 1).getTime();
}

export function computeWeekStreak(sessionTimestamps: number[]): number {
  if (sessionTimestamps.length === 0) return 0;
  const weeks = new Set(sessionTimestamps.map(startOfWeek));
  const sorted = [...weeks].sort((a, b) => b - a);
  const currentWeek = startOfWeek(Date.now());
  const mostRecent = sorted[0];
  if (mostRecent < currentWeek - DAY_MS * 7) return 0;
  let streak = 0;
  let expected = mostRecent;
  for (const w of sorted) {
    if (w === expected) {
      streak++;
      expected -= DAY_MS * 7;
    } else {
      break;
    }
  }
  return streak;
}
