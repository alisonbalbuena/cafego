import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';
import { StudySession } from '../types';

interface LockState {
  session: StudySession | null;
  isLocked: boolean;
}

const LockContext = createContext<LockState>({ session: null, isLocked: false });

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [session, setSession] = useState<StudySession | null>(null);

  useEffect(() => {
    if (!user) {
      setSession(null);
      return;
    }
    const q = query(
      collection(db, 'studySessions'),
      where('uid', '==', user.uid),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setSession(null);
      } else {
        const d = snapshot.docs[0];
        setSession({ id: d.id, ...(d.data() as any) });
      }
    });
    return unsubscribe;
  }, [user]);

  const isLocked = (() => {
    if (!session || session.distractionMode !== 'blocked') return false;
    if (session.studyMode === 'group') return !!session.locked;
    const checklist = session.checklist ?? [];
    return checklist.length > 0 && !checklist.every((item) => item.done);
  })();

  return <LockContext.Provider value={{ session, isLocked }}>{children}</LockContext.Provider>;
}

export function useActiveLock() {
  return useContext(LockContext);
}
