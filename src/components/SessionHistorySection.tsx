import React, { useMemo, useState } from 'react';
import { View, Text, Image, TextInput, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getSessionSubjectSegments, StudySession } from '../types';
import { formatDuration, formatMoney } from '../utils/format';
import { showAlert, showConfirm } from '../utils/alert';
import { UI_ICONS } from '../data/uiIcons';
import DismissKeyboardView from './DismissKeyboardView';
import { COLORS } from '../theme';

const PREVIEW_COUNT = 3;

interface Props {
  sessions: StudySession[];
}

export default function SessionHistorySection({ sessions }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAllModal, setShowAllModal] = useState(false);
  const [editingSpendId, setEditingSpendId] = useState<string | null>(null);
  const [spendDraft, setSpendDraft] = useState('');

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => b.startedAt - a.startedAt),
    [sessions]
  );

  const filtered = useMemo(
    () => sorted.filter((s) => (showArchived ? !!s.archived : !s.archived)),
    [sorted, showArchived]
  );

  const preview = filtered.slice(0, PREVIEW_COUNT);
  const archivedCount = useMemo(() => sessions.filter((s) => s.archived).length, [sessions]);

  const deleteSession = async (session: StudySession) => {
    const confirmed = await showConfirm(
      'Delete this session?',
      `This permanently removes "${session.cafeName}" from your history and stats. This can't be undone.`,
      'Delete'
    );
    if (!confirmed) return;
    setBusyId(session.id);
    try {
      await deleteDoc(doc(db, 'studySessions', session.id));
    } catch (err: any) {
      showAlert('Could not delete session', err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleArchive = async (session: StudySession) => {
    setBusyId(session.id);
    try {
      await updateDoc(doc(db, 'studySessions', session.id), { archived: !session.archived });
    } catch (err: any) {
      showAlert('Could not update session', err.message);
    } finally {
      setBusyId(null);
    }
  };

  const startEditSpend = (session: StudySession) => {
    setSpendDraft(session.amountSpent ? String(session.amountSpent) : '');
    setEditingSpendId(session.id);
  };

  const saveEditSpend = async (session: StudySession) => {
    const amount = Math.max(0, Number(spendDraft) || 0);
    setEditingSpendId(null);
    if (amount === (session.amountSpent ?? 0)) return;
    setBusyId(session.id);
    try {
      await updateDoc(doc(db, 'studySessions', session.id), { amountSpent: amount });
    } catch (err: any) {
      showAlert('Could not update spend', err.message);
    } finally {
      setBusyId(null);
    }
  };

  const renderRow = (s: StudySession) => {
    const subjects = Array.from(new Set(getSessionSubjectSegments(s).map((seg) => seg.subject)));
    const durationMs = s.endedAt != null ? s.endedAt - s.startedAt : null;
    const busy = busyId === s.id;
    const editingSpend = editingSpendId === s.id;
    return (
      <View key={s.id} style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cafeName}>
            {s.allNighter ? '🌙 ' : ''}
            {s.cafeName}
          </Text>
          <Text style={styles.meta}>
            {subjects.join(', ')} · {new Date(s.startedAt).toLocaleDateString()}
          </Text>
          <View style={styles.spendRow}>
            <Text style={styles.meta}>
              {durationMs != null ? formatDuration(durationMs) : 'In progress'}
              {editingSpend ? '' : ` · ${formatMoney(s.amountSpent ?? 0)}`}
            </Text>
            {editingSpend ? (
              <TextInput
                style={styles.spendInput}
                value={spendDraft}
                onChangeText={setSpendDraft}
                keyboardType="decimal-pad"
                autoFocus
                onSubmitEditing={() => saveEditSpend(s)}
                onBlur={() => saveEditSpend(s)}
              />
            ) : (
              <Pressable onPress={() => startEditSpend(s)} hitSlop={8}>
                <Ionicons name="pencil-outline" size={13} color={COLORS.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => toggleArchive(s)}
            disabled={busy}
            hitSlop={8}
            style={styles.actionButton}
          >
            <Ionicons
              name={s.archived ? 'arrow-undo-outline' : 'archive-outline'}
              size={18}
              color={COLORS.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={() => deleteSession(s)}
            disabled={busy}
            hitSlop={8}
            style={styles.actionButton}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Image source={UI_ICONS.sessionHistory} style={styles.titleIcon} resizeMode="contain" />
          <Text style={styles.sectionTitle}>Session history</Text>
        </View>
        {archivedCount > 0 && (
          <Pressable onPress={() => setShowArchived((v) => !v)} hitSlop={8}>
            <Text style={styles.toggleText}>
              {showArchived ? 'Show active' : `Archived (${archivedCount})`}
            </Text>
          </Pressable>
        )}
      </View>

      {preview.length === 0 ? (
        <Text style={styles.emptyText}>
          {showArchived ? 'No archived sessions.' : 'No study sessions yet.'}
        </Text>
      ) : (
        preview.map(renderRow)
      )}

      {filtered.length > PREVIEW_COUNT && (
        <Pressable style={styles.seeAllButton} onPress={() => setShowAllModal(true)}>
          <Text style={styles.seeAllText}>See all {filtered.length} sessions</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.link} />
        </Pressable>
      )}

      <Modal
        visible={showAllModal}
        animationType="slide"
        onRequestClose={() => setShowAllModal(false)}
      >
        <DismissKeyboardView>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeading}>Session history</Text>
              <Pressable onPress={() => setShowAllModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </Pressable>
            </View>

            {archivedCount > 0 && (
              <Pressable onPress={() => setShowArchived((v) => !v)} style={{ marginBottom: 12 }}>
                <Text style={styles.toggleText}>
                  {showArchived ? 'Show active sessions' : `Show archived (${archivedCount})`}
                </Text>
              </Pressable>
            )}

            <ScrollView keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={styles.emptyText}>
                  {showArchived ? 'No archived sessions.' : 'No study sessions yet.'}
                </Text>
              ) : (
                filtered.map(renderRow)
              )}
            </ScrollView>
          </View>
        </DismissKeyboardView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleIcon: { width: 16, height: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  toggleText: { fontSize: 12, color: COLORS.link, fontWeight: '600' },
  emptyText: { color: COLORS.textFaint, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cafeName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  spendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  spendInput: {
    fontSize: 12,
    color: COLORS.text,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 0,
    minWidth: 60,
  },
  actions: { flexDirection: 'row', gap: 14, marginLeft: 10 },
  actionButton: { padding: 4 },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  seeAllText: { fontSize: 13, color: COLORS.link, fontWeight: '600' },
  modalContainer: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeading: { fontSize: 22, fontWeight: '700', color: COLORS.text },
});
