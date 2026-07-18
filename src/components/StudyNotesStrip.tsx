import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { NOTE_TTL_MS, StudyNote } from '../types';
import { COLORS, RADIUS } from '../theme';
import { showAlert } from '../utils/alert';

interface Friend {
  uid: string;
  displayName: string;
}

interface Props {
  friends: Friend[];
}

const MAX_NOTE_LENGTH = 60;

export default function StudyNotesStrip({ friends }: Props) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Record<string, StudyNote>>({});
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const uids = [user.uid, ...friends.slice(0, 29).map((f) => f.uid)];
    const q = query(collection(db, 'studyNotes'), where('uid', 'in', uids));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const next: Record<string, StudyNote> = {};
      snapshot.docs.forEach((d) => {
        next[d.id] = d.data() as StudyNote;
      });
      setNotes(next);
    });
    return unsubscribe;
  }, [user, friends]);

  const myNote = user ? notes[user.uid] : undefined;
  const myNoteActive = !!myNote && Date.now() - myNote.createdAt < NOTE_TTL_MS;

  const friendNotes = useMemo(() => {
    return friends
      .map((f) => ({ friend: f, note: notes[f.uid] }))
      .filter((entry): entry is { friend: Friend; note: StudyNote } =>
        !!entry.note && Date.now() - entry.note.createdAt < NOTE_TTL_MS
      )
      .sort((a, b) => b.note.createdAt - a.note.createdAt);
  }, [friends, notes]);

  const postNote = async () => {
    if (!user || !draft.trim()) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'studyNotes', user.uid), {
        uid: user.uid,
        displayName: user.displayName ?? 'Someone',
        text: draft.trim().slice(0, MAX_NOTE_LENGTH),
        createdAt: Date.now(),
      });
      setDraft('');
      setComposing(false);
    } catch (err: any) {
      showAlert('Could not post note', err.message);
    } finally {
      setSaving(false);
    }
  };

  const clearNote = async () => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'studyNotes', user.uid));
    } catch (err: any) {
      showAlert('Could not clear note', err.message);
    }
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable
          style={[styles.card, styles.myCard]}
          onPress={() => {
            setDraft(myNoteActive ? myNote!.text : '');
            setComposing((c) => !c);
          }}
        >
          <View style={[styles.avatar, styles.myAvatar]}>
            <Text style={styles.avatarText}>
              {(user?.displayName ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.cardName}>You</Text>
          <Text style={styles.cardNote} numberOfLines={2}>
            {myNoteActive ? myNote!.text : 'Add a note'}
          </Text>
        </Pressable>

        {friendNotes.map(({ friend, note }) => (
          <View key={friend.uid} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{friend.displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.cardName} numberOfLines={1}>
              {friend.displayName}
            </Text>
            <Text style={styles.cardNote} numberOfLines={2}>
              {note.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      {composing && (
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder="Ask friends to study, plan a group session…"
            placeholderTextColor={COLORS.textFaint}
            value={draft}
            onChangeText={setDraft}
            maxLength={MAX_NOTE_LENGTH}
            autoFocus
          />
          <View style={styles.composerActions}>
            {myNoteActive && (
              <Pressable
                style={styles.clearButton}
                onPress={() => {
                  clearNote();
                  setComposing(false);
                }}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>
            )}
            <Pressable style={styles.postButton} onPress={postNote} disabled={saving || !draft.trim()}>
              <Text style={styles.postButtonText}>{saving ? 'Posting…' : 'Post'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingHorizontal: 2, paddingBottom: 4 },
  card: {
    width: 92,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  myCard: { borderColor: COLORS.accent, borderStyle: 'dashed' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  myAvatar: { backgroundColor: COLORS.accentLight },
  avatarText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  cardName: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  cardNote: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },
  composer: {
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
  },
  composerInput: { fontSize: 14, color: COLORS.text, paddingVertical: 6 },
  composerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  clearButton: { paddingVertical: 6, paddingHorizontal: 12 },
  clearButtonText: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },
  postButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  postButtonText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
});
