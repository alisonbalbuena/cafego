import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, increment, updateDoc } from 'firebase/firestore';
import { db, storage } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { useActiveLock } from '../hooks/useActiveLock';
import { showAlert } from '../utils/alert';
import { applyBuddyCode } from '../utils/buddyCode';
import { generateEscapeCode } from '../utils/code';
import { COLORS, RADIUS } from '../theme';
import { ChecklistItem, getSessionSubjectSegments } from '../types';
import { isAllNighter } from '../utils/allNighter';
import { computeStreakCoins } from '../utils/streakCoins';
import { monthKey } from '../utils/dateHelpers';
import { getRemainingOverrides, MAX_MONTHLY_OVERRIDES } from '../utils/escapeLimit';
import CoffeeMugTimer from './CoffeeMugTimer';

export default function LockOverlay() {
  const { user, profile } = useAuth();
  const { session } = useActiveLock();
  const [codeInput, setCodeInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [escapeChallenge, setEscapeChallenge] = useState<string | null>(null);
  const [escapeInput, setEscapeInput] = useState('');

  if (!session || !user) return null;

  const isGroup = session.studyMode === 'group';
  const checklist = session.checklist ?? [];
  const doneCount = checklist.filter((c) => c.done).length;
  const currentMonthKey = monthKey(Date.now());
  const remainingOverrides = getRemainingOverrides(
    profile?.escapeOverrideCount,
    profile?.escapeOverrideMonthKey,
    currentMonthKey
  );

  const applyCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setApplying(true);
    try {
      await applyBuddyCode(user.uid, code);
      setCodeInput('');
    } catch (err: any) {
      showAlert('Invalid code', err.message);
    } finally {
      setApplying(false);
    }
  };

  const toggleItem = async (item: ChecklistItem) => {
    if (uploadingId) return;
    if (item.done) {
      const next = checklist.map((c) => (c.id === item.id ? { ...c, done: false, photoUrl: undefined } : c));
      await updateDoc(doc(db, 'studySessions', session.id), { checklist: next });
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission needed', 'Allow photo access to verify this task.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingId(item.id);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const fileRef = ref(storage, `checklistPhotos/${user.uid}/${session.id}/${item.id}.jpg`);
      await uploadBytes(fileRef, blob);
      const photoUrl = await getDownloadURL(fileRef);
      const next = checklist.map((c) => (c.id === item.id ? { ...c, done: true, photoUrl } : c));
      await updateDoc(doc(db, 'studySessions', session.id), { checklist: next });
    } catch (err: any) {
      showAlert('Could not verify task', err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const beginEscape = () => {
    if (remainingOverrides <= 0) {
      showAlert(
        'No overrides left',
        `You've used all ${MAX_MONTHLY_OVERRIDES} emergency overrides this month. They reset next month.`
      );
      return;
    }
    setEscapeChallenge(generateEscapeCode());
    setEscapeInput('');
  };

  const cancelEscape = () => {
    setEscapeChallenge(null);
    setEscapeInput('');
  };

  const confirmEscape = async () => {
    if (!escapeChallenge || escapeInput !== escapeChallenge) return;
    try {
      const endedAt = Date.now();
      const totalPausedMs =
        (session.pausedMs ?? 0) + (session.pausedAt ? endedAt - session.pausedAt : 0);
      const activeMs = Math.max(0, endedAt - session.startedAt - totalPausedMs);
      const {
        coins: coinsEarned,
        newWeeklyStreak,
        newLastStudyWeekKey,
      } = computeStreakCoins(
        activeMs,
        endedAt,
        profile?.weeklyStreak ?? 0,
        profile?.lastStudyWeekKey
      );
      const earnedAllNighter = !session.allNighter && isAllNighter(session.startedAt, endedAt);
      const log = getSessionSubjectSegments(session);
      const closedLog = log.map((seg, i) => (i === log.length - 1 ? { ...seg, endedAt } : seg));
      const nextOverrideCount =
        profile?.escapeOverrideMonthKey === currentMonthKey
          ? (profile?.escapeOverrideCount ?? 0) + 1
          : 1;
      await updateDoc(doc(db, 'studySessions', session.id), {
        endedAt,
        amountSpent: 0,
        locked: false,
        subjectLog: closedLog,
        paused: false,
        pausedAt: null,
        pausedMs: totalPausedMs,
        ...(earnedAllNighter ? { allNighter: true } : {}),
      });
      await updateDoc(doc(db, 'users', user.uid), {
        ...(coinsEarned > 0 ? { petCoins: increment(coinsEarned) } : {}),
        ...(earnedAllNighter ? { allNighterCount: increment(1) } : {}),
        weeklyStreak: newWeeklyStreak,
        lastStudyWeekKey: newLastStudyWeekKey,
        escapeOverrideCount: nextOverrideCount,
        escapeOverrideMonthKey: currentMonthKey,
      });
      if (earnedAllNighter) {
        showAlert('🌙 All-nighter!', "You studied through the night — that's dedication.");
      }
    } catch (err: any) {
      showAlert('Could not end session', err.message);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.lockedTitle}>🔒 Locked in</Text>
        <CoffeeMugTimer
          startedAt={session.startedAt}
          pausedMs={session.pausedMs}
          pausedAt={session.pausedAt}
        />

        {isGroup ? (
          <>
            <Text style={styles.hint}>Ask a study buddy to enter your code again to let you out.</Text>
            {!!session.myCode && <Text style={styles.myCode}>Your code: {session.myCode}</Text>}
            <TextInput
              style={styles.codeInput}
              placeholder="Enter a buddy's code"
              placeholderTextColor={COLORS.textFaint}
              value={codeInput}
              onChangeText={setCodeInput}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Pressable style={styles.applyButton} onPress={applyCode} disabled={applying}>
              <Text style={styles.applyButtonText}>{applying ? 'Checking…' : 'Enter code'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.progress}>
              {doneCount}/{checklist.length} tasks done
            </Text>
            <ScrollView style={styles.taskList} nestedScrollEnabled>
              {checklist.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.taskRow}
                  onPress={() => toggleItem(item)}
                  disabled={uploadingId === item.id}
                >
                  <Text style={styles.taskCheckbox}>{item.done ? '✅' : '⬜️'}</Text>
                  <Text style={[styles.taskText, item.done && styles.taskTextDone]}>{item.text}</Text>
                  {uploadingId === item.id && <Text style={styles.uploading}>…</Text>}
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.hint}>Tap a task, then attach a photo to verify and check it off.</Text>
          </>
        )}

        {escapeChallenge === null ? (
          <Pressable style={styles.endButton} onPress={beginEscape}>
            <Text style={styles.endButtonText}>
              Can't unlock? End session ({remainingOverrides} left this month)
            </Text>
          </Pressable>
        ) : (
          <View style={styles.escapeCard}>
            <Text style={styles.escapeHint}>
              To end your session without being unlocked, type this exactly:
            </Text>
            <Text style={styles.escapeCode}>{escapeChallenge}</Text>
            <TextInput
              style={styles.escapeInput}
              placeholder="Type the code above"
              placeholderTextColor={COLORS.textFaint}
              value={escapeInput}
              onChangeText={setEscapeInput}
              autoCapitalize="none"
              autoCorrect={false}
              contextMenuHidden
              multiline
            />
            <Pressable
              style={[
                styles.escapeConfirmButton,
                escapeInput !== escapeChallenge && styles.escapeConfirmDisabled,
              ]}
              onPress={confirmEscape}
              disabled={escapeInput !== escapeChallenge}
            >
              <Text style={styles.escapeConfirmText}>End session</Text>
            </Pressable>
            <Pressable onPress={cancelEscape}>
              <Text style={styles.escapeCancelText}>Never mind, keep me locked in</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.bg },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 24,
    alignItems: 'center',
  },
  lockedTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  hint: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 4 },
  myCode: { fontSize: 24, fontWeight: '700', color: COLORS.primary, letterSpacing: 4, marginTop: 12 },
  codeInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    width: '100%',
    marginTop: 16,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  applyButtonText: { color: COLORS.white, fontWeight: '600', fontSize: 15 },
  progress: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  taskList: { width: '100%', maxHeight: 260, marginTop: 12 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  taskCheckbox: { fontSize: 18 },
  taskText: { fontSize: 14, color: COLORS.text, flex: 1 },
  taskTextDone: { textDecorationLine: 'line-through', color: COLORS.textFaint },
  uploading: { fontSize: 13, color: COLORS.textMuted },
  endButton: { marginTop: 20 },
  endButtonText: { fontSize: 12, color: COLORS.textFaint, textDecorationLine: 'underline' },
  escapeCard: {
    width: '100%',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    alignItems: 'center',
  },
  escapeHint: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginBottom: 10 },
  escapeCode: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.sm,
    padding: 10,
    width: '100%',
    lineHeight: 20,
  },
  escapeInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
    fontSize: 13,
    width: '100%',
    marginTop: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  escapeConfirmButton: {
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  escapeConfirmDisabled: { backgroundColor: COLORS.textFaint },
  escapeConfirmText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  escapeCancelText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
    marginTop: 12,
  },
});
