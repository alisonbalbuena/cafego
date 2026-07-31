import { auth } from '../firebase/config';

/** Firestore ID tokens are supposed to silently refresh in the background
 * roughly hourly, but on some devices that refresh can quietly fail — the
 * app still shows the user as signed in, but every write gets rejected with
 * "missing or insufficient permissions" even though the rules would allow
 * it. Wrap a write with this to force one real token refresh and retry once
 * before surfacing an error the user has no way to act on. */
export async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.code === 'permission-denied' && auth.currentUser) {
      try {
        await auth.currentUser.getIdToken(true);
        return await fn();
      } catch {
        // Refresh or retry failed — fall through and surface the original error.
      }
    }
    throw err;
  }
}
