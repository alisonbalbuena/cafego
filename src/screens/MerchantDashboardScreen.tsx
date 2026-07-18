import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CafeProgram, RewardAccount } from '../types';
import { showAlert } from '../utils/alert';
import { COLORS } from '../theme';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function MerchantDashboardScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const [program, setProgram] = useState<CafeProgram | null>(null);
  const [loyaltyCode, setLoyaltyCode] = useState('');
  const [amountSpent, setAmountSpent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.merchantCafeId) return;
    const unsubscribe = onSnapshot(doc(db, 'cafePrograms', profile.merchantCafeId), (snap) => {
      if (snap.exists()) setProgram(snap.data() as CafeProgram);
    });
    return unsubscribe;
  }, [profile?.merchantCafeId]);

  const findCustomerByCode = async (code: string) => {
    const snapshot = await getDocs(
      query(collection(db, 'users'), where('loyaltyCode', '==', code.trim().toUpperCase()))
    );
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as { uid: string; displayName: string };
  };

  const award = async () => {
    if (!user || !program) return;
    if (!loyaltyCode.trim()) {
      showAlert('Missing code', "Enter the customer's loyalty code.");
      return;
    }
    let delta = 0;
    if (program.type === 'points') {
      const spent = Number(amountSpent);
      if (!spent || spent <= 0) {
        showAlert('Missing amount', 'Enter how much the customer spent.');
        return;
      }
      delta = Math.round(spent * (program.pointsPerDollar ?? 1));
    } else {
      delta = 1;
    }
    setSubmitting(true);
    try {
      const customer = await findCustomerByCode(loyaltyCode);
      if (!customer) {
        showAlert('Not found', 'No customer has that loyalty code.');
        return;
      }
      const accountId = `${program.cafeId}_${customer.uid}`;
      const accountSnap = await getDoc(doc(db, 'rewardAccounts', accountId));
      const existing = accountSnap.exists() ? (accountSnap.data() as RewardAccount) : null;
      const now = Date.now();
      const isPunchcard = program.type === 'punchcard';
      const goal = isPunchcard ? program.punchesRequired ?? 0 : program.pointsForReward ?? 0;

      // A reward that expired without being redeemed is void — reset before adding new progress.
      const expired = !!existing?.rewardExpiresAt && existing.rewardExpiresAt < now;
      let currentValue = (isPunchcard ? existing?.punches : existing?.points) ?? 0;
      if (expired) currentValue = 0;

      const previousValue = currentValue;
      const newValue = currentValue + delta;
      const justEarned = previousValue < goal && newValue >= goal;

      const updates: Record<string, any> = {
        id: accountId,
        cafeId: program.cafeId,
        cafeName: program.cafeName,
        uid: customer.uid,
        displayName: customer.displayName,
        [isPunchcard ? 'punches' : 'points']: newValue,
        updatedAt: now,
      };
      if (expired) updates[isPunchcard ? 'points' : 'punches'] = 0;
      if (justEarned) {
        updates.rewardEarnedAt = now;
        updates.rewardExpiresAt = now + program.expiryDays * DAY_MS;
      }

      await setDoc(doc(db, 'rewardAccounts', accountId), updates, { merge: true });

      const unit = isPunchcard ? 'punches' : 'points';
      const base = `${customer.displayName} now has ${newValue} ${unit}.`;
      showAlert(
        isPunchcard ? 'Punch added' : 'Points added',
        justEarned
          ? `${base} Reward earned — redeemable until ${new Date(
              updates.rewardExpiresAt
            ).toLocaleDateString()}.`
          : base
      );
      setLoyaltyCode('');
      setAmountSpent('');
    } catch (err: any) {
      showAlert('Could not award', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const redeem = async () => {
    if (!user || !program) return;
    if (!loyaltyCode.trim()) {
      showAlert('Missing code', "Enter the customer's loyalty code.");
      return;
    }
    setSubmitting(true);
    try {
      const customer = await findCustomerByCode(loyaltyCode);
      if (!customer) {
        showAlert('Not found', 'No customer has that loyalty code.');
        return;
      }
      const accountId = `${program.cafeId}_${customer.uid}`;
      const accountSnap = await getDoc(doc(db, 'rewardAccounts', accountId));
      const account = accountSnap.exists() ? (accountSnap.data() as RewardAccount) : null;
      const isPunchcard = program.type === 'punchcard';
      const goal = isPunchcard ? program.punchesRequired ?? 0 : program.pointsForReward ?? 0;
      const current = (isPunchcard ? account?.punches : account?.points) ?? 0;
      const now = Date.now();

      if (account?.rewardExpiresAt && account.rewardExpiresAt < now && current >= goal) {
        await setDoc(
          doc(db, 'rewardAccounts', accountId),
          {
            punches: 0,
            points: 0,
            rewardEarnedAt: null,
            rewardExpiresAt: null,
            updatedAt: now,
          },
          { merge: true }
        );
        showAlert(
          'Reward expired',
          `${customer.displayName}'s reward expired on ${new Date(
            account.rewardExpiresAt
          ).toLocaleDateString()} and has been reset.`
        );
        return;
      }

      if (current < goal) {
        showAlert(
          'Not ready yet',
          `${customer.displayName} has ${current}/${goal} ${
            isPunchcard ? 'punches' : 'points'
          }.`
        );
        return;
      }

      await setDoc(
        doc(db, 'rewardAccounts', accountId),
        {
          [isPunchcard ? 'punches' : 'points']: current - goal,
          rewardEarnedAt: null,
          rewardExpiresAt: null,
          updatedAt: now,
        },
        { merge: true }
      );
      showAlert('Redeemed', `${customer.displayName} redeemed: ${program.rewardDescription}`);
      setLoyaltyCode('');
    } catch (err: any) {
      showAlert('Could not redeem', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!program) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>My Cafe</Text>
        <Text style={styles.emptyText}>Loading your program…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.heading}>{program.cafeName}</Text>
      <View style={styles.programCard}>
        <Text style={styles.programType}>
          {program.type === 'punchcard'
            ? `${program.punchesRequired} punches → reward`
            : `${program.pointsPerDollar} pt/$ · ${program.pointsForReward} pts → reward`}
        </Text>
        <Text style={styles.rewardDescription}>{program.rewardDescription}</Text>
        <Text style={styles.expiryNote}>
          Redeemable within {program.expiryDays} day{program.expiryDays === 1 ? '' : 's'} of earning
        </Text>
      </View>

      <View style={styles.linkRow}>
        <Pressable
          style={styles.linkButton}
          onPress={() => navigation.navigate('ManageAnnouncements')}
        >
          <Text style={styles.linkButtonText}>📢 Announcements</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => navigation.navigate('ManageMenu')}>
          <Text style={styles.linkButtonText}>📋 Menu</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Customer's loyalty code</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. K7M2QX"
        autoCapitalize="characters"
        value={loyaltyCode}
        onChangeText={setLoyaltyCode}
      />

      {program.type === 'points' && (
        <>
          <Text style={styles.label}>Amount spent ($)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="0.00"
            value={amountSpent}
            onChangeText={setAmountSpent}
          />
        </>
      )}

      <Pressable style={styles.button} onPress={award} disabled={submitting}>
        <Text style={styles.buttonText}>
          {submitting ? 'Working…' : program.type === 'punchcard' ? 'Add punch' : 'Add points'}
        </Text>
      </Pressable>

      <Pressable style={styles.redeemButton} onPress={redeem} disabled={submitting}>
        <Text style={styles.redeemButtonText}>Redeem reward</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  programCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  programType: { fontSize: 14, fontWeight: '600' },
  rewardDescription: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  expiryNote: { fontSize: 11, color: COLORS.textFaint, marginTop: 6 },
  linkRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  linkButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  linkButtonText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  redeemButton: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  redeemButtonText: { color: COLORS.accent, fontWeight: '600', fontSize: 15 },
  emptyText: { color: COLORS.textFaint, textAlign: 'center', marginTop: 24 },
});
