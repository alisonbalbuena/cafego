import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Looks up an active study session by its unlock code (excluding the caller's own
 * session) and flips its `locked` flag. Returns the resulting locked state.
 */
export async function applyBuddyCode(myUid: string, code: string): Promise<boolean> {
  const q = query(
    collection(db, 'studySessions'),
    where('endedAt', '==', null),
    where('myCode', '==', code)
  );
  const snap = await getDocs(q);
  const target = snap.docs.find((d) => d.data().uid !== myUid);
  if (!target) {
    throw new Error('No active study buddy found with that code.');
  }
  const nextLocked = !target.data().locked;
  await updateDoc(doc(db, 'studySessions', target.id), { locked: nextLocked });
  return nextLocked;
}
