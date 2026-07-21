export const MAX_MONTHLY_OVERRIDES = 3;

/** Remaining "can't unlock" emergency overrides for the current month, given
 * the count/monthKey stored on the profile the last time one was used. */
export function getRemainingOverrides(
  count: number | undefined,
  storedMonthKey: string | undefined,
  currentMonthKey: string
): number {
  if (storedMonthKey !== currentMonthKey) return MAX_MONTHLY_OVERRIDES;
  return Math.max(0, MAX_MONTHLY_OVERRIDES - (count ?? 0));
}
