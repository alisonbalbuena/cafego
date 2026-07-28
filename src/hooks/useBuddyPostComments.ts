import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { BuddyPostComment } from '../types';

/** Live comments for a single buddy post, oldest first (chat-style reading order). */
export function useBuddyPostComments(postId: string | null) {
  const [comments, setComments] = useState<BuddyPostComment[]>([]);

  useEffect(() => {
    if (!postId) {
      setComments([]);
      return;
    }
    const q = query(collection(db, 'buddyPostComments'), where('postId', '==', postId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as BuddyPostComment);
      docs.sort((a, b) => a.createdAt - b.createdAt);
      setComments(docs);
    });
    return unsubscribe;
  }, [postId]);

  return comments;
}
