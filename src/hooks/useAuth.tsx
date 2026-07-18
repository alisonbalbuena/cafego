import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile } from '../types';

const LOYALTY_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomLoyaltyCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += LOYALTY_CODE_CHARS[Math.floor(Math.random() * LOYALTY_CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueLoyaltyCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomLoyaltyCode();
    const existing = await getDocs(
      query(collection(db, 'users'), where('loyaltyCode', '==', code))
    );
    if (existing.empty) return code;
  }
  return `${randomLoyaltyCode()}${Date.now().toString(36).slice(-2)}`.toUpperCase();
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  initializing: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as Partial<UserProfile>;
      if (!data.role || !data.loyaltyCode) {
        // Backfill accounts created before role/loyaltyCode existed on the user doc.
        const loyaltyCode = data.loyaltyCode ?? (await generateUniqueLoyaltyCode());
        await setDoc(
          doc(db, 'users', user.uid),
          { role: data.role ?? 'customer', loyaltyCode },
          { merge: true }
        );
        return;
      }
      setProfile(data as UserProfile);
    });
    return unsubscribe;
  }, [user]);

  const signUp = async (email: string, password: string, displayName: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    const loyaltyCode = await generateUniqueLoyaltyCode();
    await setDoc(doc(db, 'users', credential.user.uid), {
      uid: credential.user.uid,
      displayName,
      email,
      createdAt: serverTimestamp(),
      role: 'customer',
      loyaltyCode,
    });
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, initializing, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
