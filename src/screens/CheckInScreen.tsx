import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
  where,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { useActiveLock } from '../hooks/useActiveLock';
import { CAFES } from '../data/cafes';
import {
  Cafe,
  ChecklistItem,
  DistractionMode,
  intensityMeta,
  SessionVisibility,
  StudyBuddy,
  StudyIntensity,
  StudyMode,
  Subject,
  STUDY_INTENSITIES,
  SUBJECTS,
} from '../types';
import { showAlert } from '../utils/alert';
import { COLORS } from '../theme';
import { distanceMiles } from '../utils/geo';
import { generateCode } from '../utils/code';
import { applyBuddyCode } from '../utils/buddyCode';
import SearchBar from '../components/SearchBar';
import CoffeeMugTimer from '../components/CoffeeMugTimer';

interface Friend {
  uid: string;
  displayName: string;
  username?: string;
}

export default function CheckInScreen() {
  const { user } = useAuth();
  const { session: activeSession } = useActiveLock();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [visibility, setVisibility] = useState<SessionVisibility>('public');
  const [intensity, setIntensity] = useState<StudyIntensity>('working');
  const [studyMode, setStudyMode] = useState<StudyMode>('solo');
  const [taggedFriends, setTaggedFriends] = useState<StudyBuddy[]>([]);
  const [friendTagSearch, setFriendTagSearch] = useState('');
  const [distractionMode, setDistractionMode] = useState<DistractionMode>('allowed');
  const [checklistDraft, setChecklistDraft] = useState<ChecklistItem[]>([]);
  const [taskDraft, setTaskDraft] = useState('');
  const [spentMoney, setSpentMoney] = useState<'yes' | 'no' | null>(null);
  const [amountSpent, setAmountSpent] = useState('');
  const [buddyCodeInput, setBuddyCodeInput] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snapshot) => setFriends(snapshot.docs.map((d) => d.data() as Friend))
    );
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return;
      const position = await Location.getCurrentPositionAsync({});
      setLocation(position);
    })();
  }, []);

  const sortedCafes = useMemo(() => {
    if (!location) return CAFES.map((c) => ({ ...c, distance: undefined as number | undefined }));
    const { latitude, longitude } = location.coords;
    return [...CAFES]
      .map((c) => ({ ...c, distance: distanceMiles(latitude, longitude, c.lat, c.lng) }))
      .sort((a, b) => a.distance - b.distance);
  }, [location]);

  const showingRecommended = !search.trim() && !!location;

  const filteredCafes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return location ? sortedCafes.slice(0, 5) : sortedCafes;
    return sortedCafes.filter(
      (c) =>
        c.name.toLowerCase().includes(term) || c.neighborhood.toLowerCase().includes(term)
    );
  }, [search, sortedCafes, location]);

  const filteredFriendsForTag = useMemo(() => {
    const term = friendTagSearch.trim().toLowerCase();
    if (!term) return friends;
    return friends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(term) ||
        (f.username ?? '').toLowerCase().includes(term)
    );
  }, [friends, friendTagSearch]);

  const toggleTaggedFriend = (friend: Friend) => {
    setTaggedFriends((prev) =>
      prev.some((f) => f.uid === friend.uid)
        ? prev.filter((f) => f.uid !== friend.uid)
        : [...prev, { uid: friend.uid, displayName: friend.displayName }]
    );
  };

  const addTask = () => {
    const text = taskDraft.trim();
    if (!text) return;
    setChecklistDraft((prev) => [...prev, { id: `${Date.now()}`, text, done: false }]);
    setTaskDraft('');
  };

  const removeTask = (id: string) => {
    setChecklistDraft((prev) => prev.filter((t) => t.id !== id));
  };

  const startSession = async () => {
    if (!user || !selectedCafe || !selectedSubject) return;
    if (studyMode === 'solo' && distractionMode === 'blocked' && checklistDraft.length === 0) return;
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        uid: user.uid,
        displayName: user.displayName ?? 'Someone',
        cafeId: selectedCafe.id,
        cafeName: selectedCafe.name,
        subject: selectedSubject,
        startedAt: Date.now(),
        endedAt: null,
        visibility,
        intensity,
        studyMode,
        distractionMode,
      };
      if (studyMode === 'group' && taggedFriends.length > 0) {
        payload.withFriends = taggedFriends;
      }
      if (distractionMode === 'blocked') {
        if (studyMode === 'solo') {
          payload.checklist = checklistDraft;
        } else {
          payload.myCode = generateCode();
          payload.locked = false;
        }
      }
      await addDoc(collection(db, 'studySessions'), payload);
      setSelectedCafe(null);
      setSelectedSubject(null);
      setSearch('');
      setVisibility('public');
      setIntensity('working');
      setStudyMode('solo');
      setTaggedFriends([]);
      setFriendTagSearch('');
      setDistractionMode('allowed');
      setChecklistDraft([]);
      setTaskDraft('');
    } catch (err: any) {
      showAlert('Could not start session', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'studySessions', activeSession.id), {
        endedAt: Date.now(),
        amountSpent: spentMoney === 'yes' ? Number(amountSpent) || 0 : 0,
      });
      setSpentMoney(null);
      setAmountSpent('');
    } catch (err: any) {
      showAlert('Could not end session', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitBuddyCode = async () => {
    if (!user || !buddyCodeInput.trim()) return;
    setApplyingCode(true);
    try {
      await applyBuddyCode(user.uid, buddyCodeInput.trim());
      setBuddyCodeInput('');
    } catch (err: any) {
      showAlert('Invalid code', err.message);
    } finally {
      setApplyingCode(false);
    }
  };

  if (activeSession) {
    const isGroupBlocked = activeSession.studyMode === 'group' && activeSession.distractionMode === 'blocked';
    const isSoloBlocked = activeSession.studyMode !== 'group' && activeSession.distractionMode === 'blocked';

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={styles.heading}>You're studying</Text>
        <View style={styles.activeCard}>
          <Text style={styles.activeCafe}>{activeSession.cafeName}</Text>
          <Text style={styles.activeSubject}>{activeSession.subject}</Text>
          <CoffeeMugTimer startedAt={activeSession.startedAt} />
          <View style={styles.activeIntensityPill}>
            <Text style={styles.activeIntensityText}>
              {intensityMeta(activeSession.intensity).emoji} {intensityMeta(activeSession.intensity).label}
            </Text>
          </View>
          {activeSession.studyMode === 'group' && !!activeSession.withFriends?.length && (
            <Text style={styles.activeWithFriends}>
              👥 With {activeSession.withFriends.map((f) => f.displayName).join(', ')}
            </Text>
          )}
          <Text style={styles.activeVisibility}>
            {activeSession.visibility === 'private' ? '🔒 Private' : '👥 Visible to friends'}
          </Text>
        </View>

        {isGroupBlocked && (
          <View style={styles.lockCard}>
            <Text style={styles.lockCardTitle}>🚫 No distractions mode</Text>
            {!!activeSession.myCode && (
              <Text style={styles.myCodeSmall}>Your code: {activeSession.myCode}</Text>
            )}
            <Text style={styles.hint}>
              Share your code with a buddy so they can lock you in. Enter a buddy's code below to
              lock (or unlock) them.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter a buddy's code"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="number-pad"
              maxLength={4}
              value={buddyCodeInput}
              onChangeText={setBuddyCodeInput}
            />
            <Pressable style={styles.button} onPress={submitBuddyCode} disabled={applyingCode}>
              <Text style={styles.buttonText}>{applyingCode ? 'Checking…' : 'Enter code'}</Text>
            </Pressable>
          </View>
        )}

        {isSoloBlocked && (
          <View style={styles.lockCard}>
            <Text style={styles.lockCardTitle}>✅ All tasks done — unlocked!</Text>
            {(activeSession.checklist ?? []).map((item) => (
              <Text key={item.id} style={styles.doneTaskText}>
                ✅ {item.text}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.label}>Did you spend any money this study session?</Text>
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, spentMoney === 'no' && styles.chipSelected]}
            onPress={() => {
              setSpentMoney('no');
              setAmountSpent('');
            }}
          >
            <Text style={[styles.chipText, spentMoney === 'no' && styles.chipTextSelected]}>
              No
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, spentMoney === 'yes' && styles.chipSelected]}
            onPress={() => setSpentMoney('yes')}
          >
            <Text style={[styles.chipText, spentMoney === 'yes' && styles.chipTextSelected]}>
              Yes
            </Text>
          </Pressable>
        </View>

        {spentMoney === 'yes' && (
          <>
            <Text style={styles.label}>How much did you spend?</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={amountSpent}
              onChangeText={setAmountSpent}
              autoFocus
            />
          </>
        )}

        <Pressable style={styles.dangerButton} onPress={endSession} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Ending…' : 'End session'}</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={styles.heading}>Start a study session</Text>

      <Text style={styles.label}>Cafe</Text>
      {selectedCafe ? (
        <Pressable style={styles.selectedPill} onPress={() => setSelectedCafe(null)}>
          <Text style={styles.selectedPillText}>{selectedCafe.name} ✕</Text>
        </Pressable>
      ) : (
        <>
          <SearchBar
            style={{ marginBottom: 8 }}
            placeholder="Search cafes (e.g. Duluth, Alchemist)"
            value={search}
            onChangeText={setSearch}
          />
          {showingRecommended && (
            <Text style={styles.recommendedLabel}>📍 Recommended near you</Text>
          )}
          <FlatList
            style={styles.cafeList}
            data={filteredCafes}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable style={styles.cafeRow} onPress={() => setSelectedCafe(item)}>
                <Text style={styles.cafeName}>{item.name}</Text>
                <Text style={styles.cafeNeighborhood}>
                  {item.neighborhood}
                  {item.distance != null ? ` · ${item.distance.toFixed(1)} mi` : ''}
                </Text>
              </Pressable>
            )}
          />
        </>
      )}

      <Text style={styles.label}>Subject</Text>
      <View style={styles.chipRow}>
        {SUBJECTS.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, selectedSubject === s && styles.chipSelected]}
            onPress={() => setSelectedSubject(s)}
          >
            <Text
              style={[
                styles.chipText,
                selectedSubject === s && styles.chipTextSelected,
              ]}
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>How locked in are you?</Text>
      <View style={styles.chipRow}>
        {STUDY_INTENSITIES.map((i) => (
          <Pressable
            key={i.value}
            style={[styles.chip, intensity === i.value && styles.chipSelected]}
            onPress={() => setIntensity(i.value)}
          >
            <Text style={[styles.chipText, intensity === i.value && styles.chipTextSelected]}>
              {i.emoji} {i.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Studying</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, studyMode === 'solo' && styles.chipSelected]}
          onPress={() => setStudyMode('solo')}
        >
          <Text style={[styles.chipText, studyMode === 'solo' && styles.chipTextSelected]}>
            🧍 By myself
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, studyMode === 'group' && styles.chipSelected]}
          onPress={() => setStudyMode('group')}
        >
          <Text style={[styles.chipText, studyMode === 'group' && styles.chipTextSelected]}>
            👥 With friends
          </Text>
        </Pressable>
      </View>

      {studyMode === 'group' && (
        <>
          <Text style={styles.label}>Tag who you're studying with</Text>
          {friends.length === 0 ? (
            <Text style={styles.emptyText}>Add friends to tag them here.</Text>
          ) : (
            <>
              {taggedFriends.length > 0 && (
                <View style={styles.chipRow}>
                  {taggedFriends.map((f) => (
                    <Pressable
                      key={f.uid}
                      style={[styles.chip, styles.chipSelected]}
                      onPress={() => toggleTaggedFriend(f)}
                    >
                      <Text style={[styles.chipText, styles.chipTextSelected]}>
                        {f.displayName} ✕
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <SearchBar
                style={{ marginBottom: 8 }}
                placeholder="Search friends by username"
                value={friendTagSearch}
                onChangeText={setFriendTagSearch}
              />
              <View style={styles.chipRow}>
                {filteredFriendsForTag
                  .filter((f) => !taggedFriends.some((t) => t.uid === f.uid))
                  .map((f) => (
                    <Pressable key={f.uid} style={styles.chip} onPress={() => toggleTaggedFriend(f)}>
                      <Text style={styles.chipText}>
                        {f.displayName}
                        {f.username ? ` · @${f.username}` : ''}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </>
          )}
        </>
      )}

      <Text style={styles.label}>Who can see this session?</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, visibility === 'public' && styles.chipSelected]}
          onPress={() => setVisibility('public')}
        >
          <Text style={[styles.chipText, visibility === 'public' && styles.chipTextSelected]}>
            👥 Friends
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, visibility === 'private' && styles.chipSelected]}
          onPress={() => setVisibility('private')}
        >
          <Text style={[styles.chipText, visibility === 'private' && styles.chipTextSelected]}>
            🔒 Just me
          </Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Distractions</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, distractionMode === 'allowed' && styles.chipSelected]}
          onPress={() => setDistractionMode('allowed')}
        >
          <Text style={[styles.chipText, distractionMode === 'allowed' && styles.chipTextSelected]}>
            ✅ Yes, allow distractions
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, distractionMode === 'blocked' && styles.chipSelected]}
          onPress={() => setDistractionMode('blocked')}
        >
          <Text style={[styles.chipText, distractionMode === 'blocked' && styles.chipTextSelected]}>
            🚫 No distractions
          </Text>
        </Pressable>
      </View>

      {distractionMode === 'blocked' && studyMode === 'solo' && (
        <>
          <Text style={styles.label}>What do you need to get done?</Text>
          {checklistDraft.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              {checklistDraft.map((item) => (
                <View key={item.id} style={styles.taskDraftRow}>
                  <Text style={styles.taskDraftText}>{item.text}</Text>
                  <Pressable onPress={() => removeTask(item.id)} hitSlop={8}>
                    <Text style={styles.taskDraftRemove}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <View style={styles.taskInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Add a task"
              placeholderTextColor={COLORS.textFaint}
              value={taskDraft}
              onChangeText={setTaskDraft}
              onSubmitEditing={addTask}
            />
            <Pressable style={styles.addTaskButton} onPress={addTask}>
              <Text style={styles.addTaskButtonText}>Add</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Once you start, you'll only see this checklist until every task is verified with a
            photo.
          </Text>
        </>
      )}

      {distractionMode === 'blocked' && studyMode === 'group' && (
        <Text style={styles.hint}>
          You'll get a personal code once you start. Give it to a study buddy so they can lock you
          in — only they can let you out again.
        </Text>
      )}

      <Pressable
        style={[
          styles.button,
          (!selectedCafe ||
            !selectedSubject ||
            (studyMode === 'solo' && distractionMode === 'blocked' && checklistDraft.length === 0)) &&
            styles.buttonDisabled,
        ]}
        onPress={startSession}
        disabled={
          !selectedCafe ||
          !selectedSubject ||
          (studyMode === 'solo' && distractionMode === 'blocked' && checklistDraft.length === 0) ||
          submitting
        }
      >
        <Text style={styles.buttonText}>
          {submitting ? 'Starting…' : 'Start studying'}
        </Text>
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginTop: 8, marginBottom: 6 },
  recommendedLabel: { fontSize: 12, fontWeight: '600', color: COLORS.accent, marginBottom: 6 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  cafeList: { marginBottom: 8 },
  cafeRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cafeName: { fontSize: 15, fontWeight: '500' },
  cafeNeighborhood: { fontSize: 12, color: COLORS.textMuted },
  selectedPill: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedPillText: { fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.text },
  chipTextSelected: { color: '#fff' },
  emptyText: { color: COLORS.textFaint, marginBottom: 12 },
  taskDraftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  taskDraftText: { fontSize: 14, color: COLORS.text, flex: 1 },
  taskDraftRemove: { fontSize: 14, color: COLORS.danger, paddingHorizontal: 8 },
  taskInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addTaskButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addTaskButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: COLORS.textFaint },
  dangerButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  activeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  activeCafe: { fontSize: 18, fontWeight: '700', alignSelf: 'flex-start' },
  activeSubject: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, alignSelf: 'flex-start' },
  activeIntensityPill: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  activeIntensityText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  activeWithFriends: { fontSize: 12, color: COLORS.textMuted, marginTop: 10, alignSelf: 'flex-start' },
  activeVisibility: { fontSize: 12, color: COLORS.textFaint, marginTop: 8, alignSelf: 'flex-start' },
  lockCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  lockCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  myCodeSmall: { fontSize: 22, fontWeight: '700', color: COLORS.primary, letterSpacing: 3, marginBottom: 8 },
  doneTaskText: { fontSize: 14, color: COLORS.textMuted, textDecorationLine: 'line-through', marginBottom: 4 },
});
