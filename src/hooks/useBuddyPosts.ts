import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { BuddyPost } from '../types';

/** Live buddy-adventure posts for a set of uids (self, or self + friends),
 * newest first. Firestore's `in` operator caps at 30 values, matching the
 * same batching convention used elsewhere in the app (friend tagging, pair
 * lookups) — callers with bigger lists should already be slicing upstream. */
export function useBuddyPosts(uids: string[], max = 20) {
  const [posts, setPosts] = useState<BuddyPost[]>([]);

  useEffect(() => {
    if (uids.length === 0) {
      setPosts([]);
      return;
    }
    const q = query(collection(db, 'buddyPosts'), where('uid', 'in', uids.slice(0, 30)));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as BuddyPost);
      docs.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(docs.slice(0, max));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(uids), max]);

  return posts;
}
