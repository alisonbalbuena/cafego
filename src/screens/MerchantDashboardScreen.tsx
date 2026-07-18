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
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CafeProgram } from '../types';
import { showAlert } from '../utils/alert';

export default function MerchantDashboardScreen() {
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
    setSubmitting(true);
    try {
      const customer = await findCustomerByCode(loyaltyCode);
      if (!customer) {
        showAlert('Not found', 'No customer has that loyalty code.');
        return;
      }
      const accountId = `${program.cafeId}_${customer.uid}`;
      if (program.type === 'punchcard') {
        await setDoc(
          doc(db, 'rewardAccounts', accountId),
          {
            id: accountId,
            cafeId: program.cafeId,
            cafeName: program.cafeName,
            uid: customer.uid,
            displayName: customer.displayName,
            punches: increment(1),
            points: increment(0),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        showAlert('Punch added', `${customer.displayName} now has one more punch.`);
      } else {
        const spent = Number(amountSpent);
        if (!spent || spent <= 0) {
          showAlert('Missing amount', 'Enter how much the customer spent.');
          return;
        }
        const pointsToAdd = Math.round(spent * (program.pointsPerDollar ?? 1));
        await setDoc(
          doc(db, 'rewardAccounts', accountId),
          {
            id: accountId,
            cafeId: program.cafeId,
            cafeName: program.cafeName,
            uid: customer.uid,
            displayName: customer.displayName,
            points: increment(pointsToAdd),
            punches: increment(0),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        showAlert('Points added', `${customer.displayName} earned ${pointsToAdd} points.`);
      }
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
      const account = accountSnap.exists() ? accountSnap.data() : { points: 0, punches: 0 };
      const goal =
        program.type === 'punchcard' ? program.punchesRequired ?? 0 : program.pointsForReward ?? 0;
      const current = program.type === 'punchcard' ? account.punches ?? 0 : account.points ?? 0;

      if (current < goal) {
        showAlert(
          'Not ready yet',
          `${customer.displayName} has ${current}/${goal} ${
            program.type === 'punchcard' ? 'punches' : 'points'
          }.`
        );
        return;
      }

      await setDoc(
        doc(db, 'rewardAccounts', accountId),
        {
          [program.type === 'punchcard' ? 'punches' : 'points']: increment(-goal),
          updatedAt: serverTimestamp(),
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
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  programCard: { backgroundColor: '#f6f6f6', borderRadius: 12, padding: 16, marginBottom: 20 },
  programType: { fontSize: 14, fontWeight: '600' },
  rewardDescription: { fontSize: 13, color: '#666', marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  redeemButton: {
    borderWidth: 1,
    borderColor: '#c0862a',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  redeemButtonText: { color: '#c0862a', fontWeight: '600', fontSize: 15 },
  emptyText: { color: '#999', textAlign: 'center', marginTop: 24 },
});
