import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CAFES } from '../data/cafes';
import { CafeAnnouncement } from '../types';
import { showAlert } from '../utils/alert';
import { COLORS, FONTS } from '../theme';
import BackButton from '../components/BackButton';

export default function ManageAnnouncementsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<CafeAnnouncement[]>([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.merchantCafeId) return;
    const q = query(
      collection(db, 'cafeAnnouncements'),
      where('cafeId', '==', profile.merchantCafeId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      docs.sort((a, b) => b.createdAt - a.createdAt);
      setAnnouncements(docs);
    });
    return unsubscribe;
  }, [profile?.merchantCafeId]);

  const post = async () => {
    if (!profile?.merchantCafeId) return;
    if (!message.trim()) {
      showAlert('Missing message', 'Write something to announce first.');
      return;
    }
    setSubmitting(true);
    try {
      const ref = doc(collection(db, 'cafeAnnouncements'));
      const cafeName = CAFES.find((c) => c.id === profile.merchantCafeId)?.name ?? 'Your cafe';
      await setDoc(ref, {
        cafeId: profile.merchantCafeId,
        cafeName,
        message: message.trim(),
        createdAt: Date.now(),
      });
      setMessage('');
    } catch (err: any) {
      showAlert('Could not post', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (announcementId: string) => {
    try {
      await deleteDoc(doc(db, 'cafeAnnouncements', announcementId));
    } catch (err: any) {
      showAlert('Could not delete', err.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.headingRow}>
        <BackButton navigation={navigation} />
        <Text style={styles.heading}>Announcements</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="New drink, sale, or any message…"
        value={message}
        onChangeText={setMessage}
        multiline
      />
      <Pressable style={styles.button} onPress={post} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Posting…' : 'Post announcement'}</Text>
      </Pressable>

      <FlatList
        style={{ marginTop: 20 }}
        data={announcements}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>No announcements yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Pressable onPress={() => remove(item.id)}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', flexShrink: 1, fontFamily: FONTS.bold, letterSpacing: 1.0 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  message: { fontSize: 14, fontFamily: FONTS.regular, letterSpacing: 0.4 },
  date: { fontSize: 11, color: COLORS.textFaint, marginTop: 4, fontFamily: FONTS.regular, letterSpacing: 0.2 },
  delete: { color: COLORS.danger, fontSize: 13, fontWeight: '600', marginLeft: 12, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  emptyText: { color: COLORS.textFaint, textAlign: 'center', marginTop: 12, fontFamily: FONTS.regular, letterSpacing: 0.3 },
});
