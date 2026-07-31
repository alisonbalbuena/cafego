export const MAX_MONTHLY_SYNC_EXITS = 3;

/** How many "leave early" exits from a synced session a user has left this
 * month. Enforced — once this hits 0, CheckInScreen blocks the "Leave early"
 * option outright until the next calendar month. */
export function getRemainingSyncExits(
  count: number | undefined,
  storedMonthKey: string | undefined,
  currentMonthKey: string
): number {
  if (storedMonthKey !== currentMonthKey) return MAX_MONTHLY_SYNC_EXITS;
  return Math.max(0, MAX_MONTHLY_SYNC_EXITS - (count ?? 0));
}
