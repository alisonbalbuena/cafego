import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { CafeProgram, CafeRequest } from '../types';
import { showAlert } from '../utils/alert';
import { COLORS, FONTS, RADIUS } from '../theme';
import { COFFEE_FRIENDS, COFFEE_EXPRESSIONS } from '../data/coffeeFriends';
import { PET_BACKGROUND_ITEMS } from '../data/petItems';

interface OwnedProgram {
  program: CafeProgram;
  ownerDisplayName: string;
  ownerEmail: string;
}

export default function AdminScreen() {
  const [pendingClaims, setPendingClaims] = useState<OwnedProgram[]>([]);
  const [allClaims, setAllClaims] = useState<OwnedProgram[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [unclaiming, setUnclaiming] = useState<string | null>(null);
  const [unlockUsername, setUnlockUsername] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [cafeRequests, setCafeRequests] = useState<CafeRequest[]>([]);
  const [decidingRequest, setDecidingRequest] = useState<string | null>(null);

  const unlockEverythingForUser = async () => {
    const cleanUsername = unlockUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername) {
      showAlert('Missing username', 'Enter a username to unlock everything for.');
      return;
    }
    setUnlocking(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, 'users'), where('username', '==', cleanUsername))
      );
      if (snapshot.empty) {
        showAlert('Not found', `No account found with username "${cleanUsername}".`);
        return;
      }
      const targetUid = snapshot.docs[0].id;
      await updateDoc(doc(db, 'users', targetUid), {
        unlockedCoffeeFriends: COFFEE_FRIENDS.map((f) => f.id),
        unlockedExpressions: COFFEE_EXPRESSIONS.map((e) => e.id),
        petBackgroundsOwned: PET_BACKGROUND_ITEMS.map((b) => b.id),
      });
      showAlert('Unlocked', `Everything is now unlocked for @${cleanUsername}.`);
      setUnlockUsername('');
    } catch (err: any) {
      showAlert('Could not unlock', err.message);
    } finally {
      setUnlocking(false);
    }
  };

  const attachOwners = async (programs: CafeProgram[]): Promise<OwnedProgram[]> => {
    return Promise.all(
      programs.map(async (program) => {
        const ownerSnap = await getDoc(doc(db, 'users', program.ownerUid));
        const owner = ownerSnap.exists() ? (ownerSnap.data() as any) : null;
        return {
          program,
          ownerDisplayName: owner?.displayName ?? 'Unknown',
          ownerEmail: owner?.email ?? 'unknown',
        };
      })
    );
  };

  useEffect(() => {
    const q = query(collection(db, 'cafeRequests'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCafeRequests(
        snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }) as CafeRequest)
          .sort((a, b) => a.createdAt - b.createdAt)
      );
    });
    return unsubscribe;
  }, []);

  const decideCafeRequest = async (request: CafeRequest, status: 'approved' | 'rejected') => {
    setDecidingRequest(request.id);
    try {
      await updateDoc(doc(db, 'cafeRequests', request.id), { status });
    } catch (err: any) {
      showAlert('Could not update request', err.message);
    } finally {
      setDecidingRequest(null);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'cafePrograms'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setPendingClaims(await attachOwners(snapshot.docs.map((d) => d.data() as CafeProgram)));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'cafePrograms'), async (snapshot) => {
      setAllClaims(await attachOwners(snapshot.docs.map((d) => d.data() as CafeProgram)));
    });
    return unsubscribe;
  }, []);

  const approve = async (claim: OwnedProgram) => {
    setApproving(claim.program.cafeId);
    try {
      await updateDoc(doc(db, 'cafePrograms', claim.program.cafeId), {
        status: 'approved',
      });
      await updateDoc(doc(db, 'users', claim.program.ownerUid), {
        role: 'merchant',
        merchantCafeId: claim.program.cafeId,
      });
      showAlert('Approved', `${claim.program.cafeName} is now live.`);
    } catch (err: any) {
      showAlert('Could not approve', err.message);
    } finally {
      setApproving(null);
    }
  };

  const unclaim = async (claim: OwnedProgram) => {
    const cafeId = claim.program.cafeId;
    setUnclaiming(cafeId);
    try {
      const deleteAllMatching = async (collectionName: string) => {
        const snap = await getDocs(
          query(collection(db, collectionName), where('cafeId', '==', cafeId))
        );
        await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, collectionName, d.id))));
      };
      await deleteAllMatching('rewardAccounts');
      await deleteAllMatching('cafeAnnouncements');
      await deleteAllMatching('menuItems');
      await deleteDoc(doc(db, 'cafePrograms', cafeId));
      await updateDoc(doc(db, 'users', claim.program.ownerUid), {
        role: 'customer',
        merchantCafeId: deleteField(),
        pendingCafeId: deleteField(),
      });
      showAlert('Unclaimed', `${claim.program.cafeName} is now available to claim again.`);
    } catch (err: any) {
      showAlert('Could not unclaim', err.message);
    } finally {
      setUnclaiming(null);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pendingClaims}
        keyExtractor={(item) => item.program.cafeId}
        ListHeaderComponent={
          <>
            <Text style={styles.heading}>Unlock everything for a user</Text>
            <View style={styles.unlockCard}>
              <TextInput
                style={styles.unlockInput}
                placeholder="username"
                placeholderTextColor={COLORS.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                value={unlockUsername}
                onChangeText={setUnlockUsername}
              />
              <Pressable
                style={styles.unlockButton}
                onPress={unlockEverythingForUser}
                disabled={unlocking}
              >
                <Text style={styles.unlockButtonText}>{unlocking ? '…' : 'Unlock all'}</Text>
              </Pressable>
            </View>

            <Text style={[styles.heading, { marginTop: 24 }]}>Cafe suggestions</Text>
            {cafeRequests.length === 0 ? (
              <Text style={styles.emptyText}>No pending suggestions.</Text>
            ) : (
              cafeRequests.map((request) => (
                <View key={request.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cafeName}>{request.name}</Text>
                    <Text style={styles.owner}>{request.address}</Text>
                    <Text style={styles.programInfo}>Suggested by {request.submittedByName}</Text>
                  </View>
                  <Pressable
                    style={styles.approveButton}
                    onPress={() => decideCafeRequest(request, 'approved')}
                    disabled={decidingRequest === request.id}
                  >
                    <Text style={styles.approveButtonText}>
                      {decidingRequest === request.id ? '…' : 'Approve'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.unclaimButton}
                    onPress={() => decideCafeRequest(request, 'rejected')}
                    disabled={decidingRequest === request.id}
                  >
                    <Text style={styles.unclaimButtonText}>Reject</Text>
                  </Pressable>
                </View>
              ))
            )}

            <Text style={[styles.heading, { marginTop: 24 }]}>Pending cafe claims</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No pending claims.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cafeName}>{item.program.cafeName}</Text>
              <Text style={styles.owner}>
                Claimed by {item.ownerDisplayName} ({item.ownerEmail})
              </Text>
              <Text style={styles.programInfo}>
                {item.program.type === 'punchcard'
                  ? `${item.program.punchesRequired} punches → reward`
                  : `${item.program.pointsPerDollar} pt/$ · ${item.program.pointsForReward} pts → reward`}
                {' · '}
                {item.program.rewardDescription}
              </Text>
            </View>
            <Pressable
              style={styles.approveButton}
              onPress={() => approve(item)}
              disabled={approving === item.program.cafeId}
            >
              <Text style={styles.approveButtonText}>
                {approving === item.program.cafeId ? '…' : 'Approve'}
              </Text>
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <View style={{ marginTop: 24 }}>
            <Text style={styles.heading}>All claimed cafes</Text>
            {allClaims.length === 0 ? (
              <Text style={styles.emptyText}>No cafes claimed yet.</Text>
            ) : (
              allClaims.map((item) => (
                <View key={item.program.cafeId} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cafeName}>
                      {item.program.cafeName}{' '}
                      <Text style={styles.statusTag}>({item.program.status})</Text>
                    </Text>
                    <Text style={styles.owner}>
                      {item.ownerDisplayName} ({item.ownerEmail})
                    </Text>
                  </View>
                  <Pressable
                    style={styles.unclaimButton}
                    onPress={() => unclaim(item)}
                    disabled={unclaiming === item.program.cafeId}
                  >
                    <Text style={styles.unclaimButtonText}>
                      {unclaiming === item.program.cafeId ? '…' : 'Unclaim'}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16, fontFamily: FONTS.bold, letterSpacing: 1.0 },
  unlockCard: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  unlockInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  unlockButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  unlockButtonText: { color: '#fff', fontWeight: '600', fontSize: 13, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  emptyText: { color: COLORS.textFaint, textAlign: 'center', marginTop: 12, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cafeName: { fontSize: 16, fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  statusTag: { fontSize: 12, color: COLORS.textFaint, fontWeight: '400', fontFamily: FONTS.regular, letterSpacing: 0.3 },
  owner: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  programInfo: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  approveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginLeft: 12,
  },
  approveButtonText: { color: '#fff', fontWeight: '600', fontSize: 13, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  unclaimButton: {
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginLeft: 12,
  },
  unclaimButtonText: { color: COLORS.danger, fontWeight: '600', fontSize: 13, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
});
