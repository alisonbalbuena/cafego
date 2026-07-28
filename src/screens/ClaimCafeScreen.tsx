import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CAFES } from '../data/cafes';
import { Cafe, LoyaltyProgramType } from '../types';
import { showAlert } from '../utils/alert';
import { VERIFICATION_CONTACT } from '../constants';
import { COLORS, FONTS } from '../theme';
import SearchBar from '../components/SearchBar';
import BackButton from '../components/BackButton';

export default function ClaimCafeScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [programType, setProgramType] = useState<LoyaltyProgramType>('punchcard');
  const [punchesRequired, setPunchesRequired] = useState('10');
  const [pointsPerDollar, setPointsPerDollar] = useState('1');
  const [pointsForReward, setPointsForReward] = useState('100');
  const [rewardDescription, setRewardDescription] = useState('');
  const [expiryDays, setExpiryDays] = useState('30');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const snapshot = await getDocs(collection(db, 'cafePrograms'));
      setClaimedIds(new Set(snapshot.docs.map((d) => d.id)));
    })();
  }, []);

  const filteredCafes = useMemo(() => {
    const available = CAFES.filter((c) => !claimedIds.has(c.id));
    if (!search.trim()) return available;
    const term = search.toLowerCase();
    return available.filter(
      (c) =>
        c.name.toLowerCase().includes(term) || c.neighborhood.toLowerCase().includes(term)
    );
  }, [search, claimedIds]);

  const submit = async () => {
    if (!user || !selectedCafe) return;
    if (!rewardDescription.trim()) {
      showAlert('Missing info', 'Describe the reward (e.g. "Free drink of your choice").');
      return;
    }
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'cafePrograms', selectedCafe.id), {
        cafeId: selectedCafe.id,
        cafeName: selectedCafe.name,
        ownerUid: user.uid,
        status: 'pending',
        type: programType,
        rewardDescription: rewardDescription.trim(),
        expiryDays: Number(expiryDays) || 30,
        ...(programType === 'punchcard'
          ? { punchesRequired: Number(punchesRequired) || 10 }
          : {
              pointsPerDollar: Number(pointsPerDollar) || 1,
              pointsForReward: Number(pointsForReward) || 100,
            }),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', user.uid), {
        pendingCafeId: selectedCafe.id,
      });
      showAlert(
        'Claim submitted',
        `To verify you own ${selectedCafe.name}, contact ${VERIFICATION_CONTACT}. Your rewards program will go live once verified.`
      );
      navigation.goBack();
    } catch (err: any) {
      showAlert('Could not set up program', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (profile?.pendingCafeId) {
    return (
      <View style={styles.container}>
        <View style={styles.headingRow}>
          <BackButton navigation={navigation} />
          <Text style={styles.heading}>Verification pending</Text>
        </View>
        <Text style={styles.pendingText}>
          Your claim is awaiting verification. Contact {VERIFICATION_CONTACT} to confirm you own
          this cafe — your rewards program will go live once approved.
        </Text>
      </View>
    );
  }

  if (!selectedCafe) {
    return (
      <View style={styles.container}>
        <View style={styles.headingRow}>
          <BackButton navigation={navigation} />
          <Text style={styles.heading}>Which cafe do you own?</Text>
        </View>
        <SearchBar
          style={{ marginBottom: 8 }}
          placeholder="Search cafes (e.g. Duluth, Alchemist)"
          value={search}
          onChangeText={setSearch}
        />
        <FlatList
          data={filteredCafes}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No unclaimed cafes match your search.</Text>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.cafeRow} onPress={() => setSelectedCafe(item)}>
              <Text style={styles.cafeName}>{item.name}</Text>
              <Text style={styles.cafeNeighborhood}>{item.neighborhood}</Text>
            </Pressable>
          )}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.headingRow}>
        <BackButton navigation={navigation} />
        <Text style={styles.heading}>Set up your program</Text>
      </View>
      <Pressable style={styles.selectedPill} onPress={() => setSelectedCafe(null)}>
        <Text style={styles.selectedPillText}>{selectedCafe.name} ✕</Text>
      </Pressable>

      <Text style={styles.label}>Program type</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, programType === 'punchcard' && styles.chipSelected]}
          onPress={() => setProgramType('punchcard')}
        >
          <Text
            style={[styles.chipText, programType === 'punchcard' && styles.chipTextSelected]}
          >
            Punch card
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, programType === 'points' && styles.chipSelected]}
          onPress={() => setProgramType('points')}
        >
          <Text style={[styles.chipText, programType === 'points' && styles.chipTextSelected]}>
            Points per $
          </Text>
        </Pressable>
      </View>

      {programType === 'punchcard' ? (
        <>
          <Text style={styles.label}>Punches needed for a reward</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={punchesRequired}
            onChangeText={setPunchesRequired}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Points earned per $1 spent</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={pointsPerDollar}
            onChangeText={setPointsPerDollar}
          />
          <Text style={styles.label}>Points needed for a reward</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={pointsForReward}
            onChangeText={setPointsForReward}
          />
        </>
      )}

      <Text style={styles.label}>Reward description</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Free drink of your choice"
        value={rewardDescription}
        onChangeText={setRewardDescription}
      />

      <Text style={styles.label}>Days to redeem once earned</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={expiryDays}
        onChangeText={setExpiryDays}
      />

      <Pressable style={styles.button} onPress={submit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Saving…' : 'Launch program'}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', flexShrink: 1, fontFamily: FONTS.bold, letterSpacing: 1.0 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 12,
    marginBottom: 6,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  cafeRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  cafeName: { fontSize: 15, fontWeight: '500', fontFamily: FONTS.medium, letterSpacing: 0.4 },
  cafeNeighborhood: { fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  selectedPill: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedPillText: { fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.text, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  chipTextSelected: { color: '#fff' },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  emptyText: { color: COLORS.textFaint, textAlign: 'center', marginTop: 24, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  pendingText: { fontSize: 15, color: COLORS.text, lineHeight: 22, fontFamily: FONTS.regular, letterSpacing: 0.4 },
});
