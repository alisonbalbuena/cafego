import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CafeProgram, RewardAccount } from '../types';
import { VERIFICATION_CONTACT } from '../constants';
import { COLORS } from '../theme';

export default function RewardsScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const [programs, setPrograms] = useState<CafeProgram[]>([]);
  const [accounts, setAccounts] = useState<Record<string, RewardAccount>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'cafePrograms'), (snapshot) => {
      setPrograms(snapshot.docs.map((d) => d.data() as CafeProgram));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rewardAccounts'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const next: Record<string, RewardAccount> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as RewardAccount;
        next[data.cafeId] = data;
      });
      setAccounts(next);
    });
    return unsubscribe;
  }, [user]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Rewards</Text>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Your loyalty code</Text>
        <Text style={styles.code}>{profile?.loyaltyCode ?? '······'}</Text>
        <Text style={styles.codeHint}>Show this to the cashier to earn rewards</Text>
      </View>

      {profile?.pendingCafeId && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingText}>
            Your cafe claim is awaiting verification — contact {VERIFICATION_CONTACT} to confirm
            ownership.
          </Text>
        </View>
      )}

      <FlatList
        style={{ flex: 1 }}
        data={programs.filter((p) => p.status !== 'pending')}
        keyExtractor={(item) => item.cafeId}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No cafes have set up rewards yet.</Text>
        }
        renderItem={({ item }) => {
          const account = accounts[item.cafeId];
          const isPunchcard = item.type === 'punchcard';
          const current = isPunchcard ? account?.punches ?? 0 : account?.points ?? 0;
          const goal = isPunchcard ? item.punchesRequired ?? 0 : item.pointsForReward ?? 0;
          const earned = goal > 0 && current >= goal;
          return (
            <View style={styles.programRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cafeName}>{item.cafeName}</Text>
                <Text style={styles.rewardDescription}>{item.rewardDescription}</Text>
                <Text style={[styles.progress, earned && styles.progressEarned]}>
                  {earned
                    ? account?.rewardExpiresAt
                      ? `🎉 Reward ready — redeem by ${new Date(
                          account.rewardExpiresAt
                        ).toLocaleDateString()}`
                      : '🎉 Reward ready — redeem at checkout'
                    : isPunchcard
                    ? `${current} / ${goal} punches`
                    : `${current} / ${goal} points`}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {profile?.role === 'customer' && !profile.pendingCafeId && (
        <Pressable
          style={styles.merchantButton}
          onPress={() => navigation.navigate('ClaimCafe')}
        >
          <Text style={styles.merchantButtonText}>Own a cafe? Set up your rewards program</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  codeCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  codeLabel: { color: COLORS.textFaint, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  code: { color: '#fff', fontSize: 32, fontWeight: '700', letterSpacing: 4, marginVertical: 6 },
  codeHint: { color: COLORS.textFaint, fontSize: 12 },
  programRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cafeName: { fontSize: 16, fontWeight: '600' },
  rewardDescription: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  progress: { fontSize: 13, color: COLORS.success, fontWeight: '600', marginTop: 6 },
  progressEarned: { color: COLORS.accent },
  emptyText: { color: COLORS.textFaint, textAlign: 'center', marginTop: 24 },
  merchantButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  merchantButtonText: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  pendingCard: {
    backgroundColor: '#fff6e6',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  pendingText: { fontSize: 13, color: '#7a5a1a', lineHeight: 18 },
});
