import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { addDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { DAY_MS, dateKey } from '../utils/dateHelpers';
import { showAlert } from '../utils/alert';
import { COLORS, RADIUS, FONTS } from '../theme';
import SearchBar from '../components/SearchBar';
import BackButton from '../components/BackButton';

// Defaults until you decide real amounts — see PetScreen/coffeeFriends.ts for
// where these numbers would eventually become tunable.
const DAILY_BONUS_COINS = 5;
const PENALTY_COINS = 10;
const GROUP_REWARD_COINS = 15;

interface Friend {
  uid: string;
  displayName: string;
  username?: string;
}

export default function CreateStudyPlanScreen({ navigation }: any) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [dailyMinutes, setDailyMinutes] = useState('60');
  const [missThreshold, setMissThreshold] = useState<1 | 2>(1);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snapshot) => setFriends(snapshot.docs.map((d) => d.data() as Friend))
    );
    return unsubscribe;
  }, [user]);

  const toggleFriend = (friend: Friend) => {
    setSelectedFriends((prev) =>
      prev.some((f) => f.uid === friend.uid)
        ? prev.filter((f) => f.uid !== friend.uid)
        : [...prev, friend]
    );
  };

  const filteredFriends = friends.filter((f) => {
    const term = friendSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      f.displayName.toLowerCase().includes(term) || (f.username ?? '').toLowerCase().includes(term)
    );
  });

  const submit = async () => {
    if (!user) return;
    const cleanSubject = subject.trim();
    if (!cleanSubject) {
      showAlert('Missing info', 'What are you studying for? (subject, exam, chapter, etc.)');
      return;
    }
    const cleanDurationDays = Math.max(1, Math.round(Number(durationDays)) || 7);
    setSubmitting(true);
    try {
      const startDateKey = dateKey(Date.now());
      const endDateKey = dateKey(Date.now() + (cleanDurationDays - 1) * DAY_MS);
      const memberUids = [user.uid, ...selectedFriends.map((f) => f.uid)];
      const memberNames: Record<string, string> = {
        [user.uid]: user.displayName ?? 'Someone',
      };
      selectedFriends.forEach((f) => {
        memberNames[f.uid] = f.displayName;
      });
      await addDoc(collection(db, 'studyPlans'), {
        name: name.trim() || `${cleanSubject} Study Plan`,
        subject: cleanSubject,
        createdBy: user.uid,
        memberUids,
        memberNames,
        durationDays: cleanDurationDays,
        startDateKey,
        endDateKey,
        dailyMinMinutes: Math.max(5, Number(dailyMinutes) || 60),
        missThreshold,
        dailyBonusCoins: DAILY_BONUS_COINS,
        penaltyCoins: PENALTY_COINS,
        groupRewardCoins: GROUP_REWARD_COINS,
        createdAt: Date.now(),
      });
      navigation.goBack();
    } catch (err: any) {
      showAlert('Could not create plan', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}>
          <BackButton navigation={navigation} />
          <Text style={styles.heading}>New study plan</Text>
        </View>

        <Text style={styles.label}>What's the plan for?</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Chem final, Ch. 5-7, Book of John"
          placeholderTextColor={COLORS.textFaint}
          value={subject}
          onChangeText={setSubject}
        />

        <Text style={styles.label}>Plan name (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Chem Crunch Week"
          placeholderTextColor={COLORS.textFaint}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>How long? (days)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 7"
          placeholderTextColor={COLORS.textFaint}
          keyboardType="number-pad"
          value={durationDays}
          onChangeText={setDurationDays}
        />

        <Text style={styles.label}>Daily minimum (minutes)</Text>
        <TextInput
          style={styles.input}
          placeholder="60"
          placeholderTextColor={COLORS.textFaint}
          keyboardType="number-pad"
          value={dailyMinutes}
          onChangeText={setDailyMinutes}
        />

        <Text style={styles.label}>How many missed days before losing coins?</Text>
        <View style={styles.chipRow}>
          {[1, 2].map((n) => (
            <Pressable
              key={n}
              style={[styles.chip, missThreshold === n && styles.chipSelected]}
              onPress={() => setMissThreshold(n as 1 | 2)}
            >
              <Text style={[styles.chipText, missThreshold === n && styles.chipTextSelected]}>
                More than {n} day{n === 1 ? '' : 's'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>
          Meet the goal and everyone earns coins each day. Miss more than this, and coins get
          deducted once. If the whole group never misses, everyone unlocks a special reward.
        </Text>

        <Text style={styles.label}>Invite friends (optional — you can also fly solo)</Text>
        {selectedFriends.length > 0 && (
          <View style={styles.chipRow}>
            {selectedFriends.map((f) => (
              <Pressable
                key={f.uid}
                style={[styles.chip, styles.chipSelected]}
                onPress={() => toggleFriend(f)}
              >
                <Text style={[styles.chipText, styles.chipTextSelected]}>{f.displayName} ✕</Text>
              </Pressable>
            ))}
          </View>
        )}
        <SearchBar
          style={{ marginBottom: 8 }}
          placeholder="Search friends by username"
          value={friendSearch}
          onChangeText={setFriendSearch}
        />
        <View style={styles.chipRow}>
          {filteredFriends
            .filter((f) => !selectedFriends.some((s) => s.uid === f.uid))
            .map((f) => (
              <Pressable key={f.uid} style={styles.chip} onPress={() => toggleFriend(f)}>
                <Text style={styles.chipText}>
                  {f.displayName}
                  {f.username ? ` · @${f.username}` : ''}
                </Text>
              </Pressable>
            ))}
        </View>

        <Pressable style={styles.button} onPress={submit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Creating…' : 'Create plan'}</Text>
        </Pressable>
      </ScrollView>
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
  hint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12, lineHeight: 17, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
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
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
});
