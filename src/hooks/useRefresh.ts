import { useCallback, useState } from 'react';

// Every screen's data comes from live Firestore listeners, so there's nothing
// stale to actually re-fetch on pull-to-refresh — this just gives the familiar
// pull-down gesture a brief, honest spinner acknowledging the data is current.
export function useRefresh(delayMs = 600) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), delayMs);
  }, [delayMs]);

  return { refreshing, onRefresh };
}
