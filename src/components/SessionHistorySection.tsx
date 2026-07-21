import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getSessionSubjectSegments, StudySession } from '../types';
import { formatDuration, formatMoney } from '../utils/format';
import { showAlert, showConfirm } from '../utils/alert';
import { COLORS } from '../theme';

const PREVIEW_COUNT = 3;

interface Props {
  sessions: StudySession[];
}

export default function SessionHistorySection({ sessions }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAllModal, setShowAllModal] = useState(false);

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

  const renderRow = (s: StudySession) => {
    const subjects = Array.from(new Set(getSessionSubjectSegments(s).map((seg) => seg.subject)));
    const durationMs = s.endedAt != null ? s.endedAt - s.startedAt : null;
    const busy = busyId === s.id;
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
          <Text style={styles.meta}>
            {durationMs != null ? formatDuration(durationMs) : 'In progress'}
            {s.amountSpent ? ` · ${formatMoney(s.amountSpent)}` : ''}
          </Text>
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
        <Text style={styles.sectionTitle}>🗓️ Session history</Text>
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

          <ScrollView>
            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>
                {showArchived ? 'No archived sessions.' : 'No study sessions yet.'}
              </Text>
            ) : (
              filtered.map(renderRow)
            )}
          </ScrollView>
        </View>
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
