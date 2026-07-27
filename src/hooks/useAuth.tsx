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
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile } from '../types';
import { DEFAULT_COFFEE_FRIEND_ID } from '../data/coffeeFriends';

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

export async function generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
  const base =
    `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(Math.random() * 10000)}`;
    const existing = await getDocs(
      query(collection(db, 'users'), where('username', '==', candidate))
    );
    if (existing.empty) return candidate;
  }
  return `${base}${Date.now().toString(36).slice(-4)}`;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  initializing: boolean;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    username: string
  ) => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Resolves a login identifier to an email address, so users can log in with
 * either. Firebase Auth itself only understands email/password. */
async function resolveLoginEmail(identifier: string): Promise<string> {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) return trimmed;

  const username = trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const snapshot = await getDoc(doc(db, 'usernameEmails', username));
  if (!snapshot.exists()) {
    throw new Error('No account found with that username.');
  }
  return (snapshot.data() as { email: string }).email;
}

/** Best-effort backfill for accounts created before username login existed. */
async function ensureUsernameEmailMapping(uid: string, username: string, email: string) {
  if (!username || !email) return;
  try {
    const mappingRef = doc(db, 'usernameEmails', username);
    const existing = await getDoc(mappingRef);
    if (!existing.exists()) {
      await setDoc(mappingRef, { uid, email });
    }
  } catch {
    // Non-critical — the user can still log in with email.
  }
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
      if (!data.role || !data.loyaltyCode || !data.username || !data.firstName) {
        // Backfill accounts created before these fields existed on the user doc.
        const [fallbackFirst, ...rest] = (data.displayName ?? 'User').split(' ');
        const firstName = data.firstName ?? fallbackFirst ?? 'User';
        const lastName = data.lastName ?? rest.join(' ');
        const loyaltyCode = data.loyaltyCode ?? (await generateUniqueLoyaltyCode());
        const username = data.username ?? (await generateUniqueUsername(firstName, lastName));
        await setDoc(
          doc(db, 'users', user.uid),
          {
            role: data.role ?? 'customer',
            loyaltyCode,
            firstName,
            lastName,
            username,
            bio: data.bio ?? '',
          },
          { merge: true }
        );
        return;
      }
      if (data.petCoins === undefined) {
        // Backfill accounts created before the coin/coffee-friends game existed.
        await setDoc(
          doc(db, 'users', user.uid),
          {
            petCoins: 0,
            unlockedCoffeeFriends: [DEFAULT_COFFEE_FRIEND_ID],
            activeCoffeeFriend: DEFAULT_COFFEE_FRIEND_ID,
            allNighterCount: 0,
          },
          { merge: true }
        );
        return;
      }
      if (data.unlockedCoffeeFriends === undefined) {
        // Backfill accounts created before the buddy system was replaced with
        // unlockable coffee friends.
        await setDoc(
          doc(db, 'users', user.uid),
          { unlockedCoffeeFriends: [DEFAULT_COFFEE_FRIEND_ID], activeCoffeeFriend: DEFAULT_COFFEE_FRIEND_ID },
          { merge: true }
        );
        return;
      }
      if (data.allNighterCount === undefined) {
        // Backfill accounts created before the all-nighter tracker existed.
        await setDoc(doc(db, 'users', user.uid), { allNighterCount: 0 }, { merge: true });
        return;
      }
      if (data.username) {
        ensureUsernameEmailMapping(user.uid, data.username, data.email ?? user.email ?? '');
      }
      setProfile(data as UserProfile);
    });
    return unsubscribe;
  }, [user]);

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    username: string
  ) => {
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername) {
      throw new Error('Username can only contain letters, numbers, and underscores.');
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    // Username uniqueness can only be checked once signed in, since reads require auth.
    // If it's taken, undo the just-created account rather than leaving an orphaned one.
    const existing = await getDocs(
      query(collection(db, 'users'), where('username', '==', cleanUsername))
    );
    if (!existing.empty) {
      await credential.user.delete();
      throw new Error('That username is already taken.');
    }

    const displayName = `${firstName} ${lastName}`.trim();
    await updateProfile(credential.user, { displayName });
    const loyaltyCode = await generateUniqueLoyaltyCode();
    await setDoc(doc(db, 'usernameEmails', cleanUsername), {
      uid: credential.user.uid,
      email,
    });
    await setDoc(doc(db, 'users', credential.user.uid), {
      uid: credential.user.uid,
      displayName,
      firstName,
      lastName,
      username: cleanUsername,
      bio: '',
      email,
      createdAt: serverTimestamp(),
      role: 'customer',
      loyaltyCode,
      petCoins: 0,
      unlockedCoffeeFriends: [DEFAULT_COFFEE_FRIEND_ID],
      activeCoffeeFriend: DEFAULT_COFFEE_FRIEND_ID,
      allNighterCount: 0,
    });
  };

  const signIn = async (identifier: string, password: string) => {
    const email = await resolveLoginEmail(identifier);
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
