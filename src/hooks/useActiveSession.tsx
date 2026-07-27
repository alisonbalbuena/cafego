import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';
import { StudySession } from '../types';

interface ActiveSessionState {
  session: StudySession | null;
}

const ActiveSessionContext = createContext<ActiveSessionState>({ session: null });

export function ActiveSessionProvider({ children }: { children: React.ReactNode }) {
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

  return <ActiveSessionContext.Provider value={{ session }}>{children}</ActiveSessionContext.Provider>;
}

export function useActiveSession() {
  return useContext(ActiveSessionContext);
}
