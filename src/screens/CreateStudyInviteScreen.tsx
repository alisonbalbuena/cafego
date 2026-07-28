import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { addDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { showAlert } from '../utils/alert';
import { COLORS, RADIUS, FONTS } from '../theme';
import SearchBar from '../components/SearchBar';
import BackButton from '../components/BackButton';
import InviteDateTimePicker from '../components/InviteDateTimePicker';

interface Friend {
  uid: string;
  displayName: string;
  username?: string;
}

export default function CreateStudyInviteScreen({ navigation }: any) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 60 * 60000));
  const [durationMin, setDurationMin] = useState('90');
  const [subject, setSubject] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snapshot) => setFriends(snapshot.docs.map((d) => d.data() as Friend))
    );
    return unsubscribe;
  }, [user]);

  const filteredFriends = friends.filter((f) => {
    const term = friendSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      f.displayName.toLowerCase().includes(term) || (f.username ?? '').toLowerCase().includes(term)
    );
  });

  const submit = async () => {
    if (!user || !selectedFriend) {
      showAlert('Missing info', 'Pick a friend to invite.');
      return;
    }
    if (scheduledAt.getTime() <= Date.now()) {
      showAlert('Pick a future time', 'The session needs to be scheduled ahead of time.');
      return;
    }
    setSubmitting(true);
    try {
      const cleanSubject = subject.trim();
      await addDoc(collection(db, 'studyInvites'), {
        fromUid: user.uid,
        fromName: user.displayName ?? 'Someone',
        toUid: selectedFriend.uid,
        toName: selectedFriend.displayName,
        scheduledAt: scheduledAt.getTime(),
        durationMin: Math.max(5, Number(durationMin) || 90),
        ...(cleanSubject ? { subject: cleanSubject } : {}),
        status: 'pending',
        createdAt: Date.now(),
      });
      navigation.goBack();
    } catch (err: any) {
      showAlert('Could not send invite', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <BackButton navigation={navigation} />
        <Text style={styles.heading}>Invite a friend</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Who?</Text>
        {selectedFriend ? (
          <Pressable style={styles.selectedPill} onPress={() => setSelectedFriend(null)}>
            <Text style={styles.selectedPillText}>{selectedFriend.displayName} ✕</Text>
          </Pressable>
        ) : (
          <>
            <SearchBar
              style={{ marginBottom: 8 }}
              placeholder="Search friends by username"
              value={friendSearch}
              onChangeText={setFriendSearch}
            />
            <View style={styles.chipRow}>
              {filteredFriends.map((f) => (
                <Pressable key={f.uid} style={styles.chip} onPress={() => setSelectedFriend(f)}>
                  <Text style={styles.chipText}>
                    {f.displayName}
                    {f.username ? ` · @${f.username}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>When?</Text>
        <InviteDateTimePicker value={scheduledAt} onChange={setScheduledAt} />

        <Text style={styles.label}>How long? (minutes)</Text>
        <TextInput
          style={styles.input}
          placeholder="90"
          placeholderTextColor={COLORS.textFaint}
          keyboardType="number-pad"
          value={durationMin}
          onChangeText={setDurationMin}
        />

        <Text style={styles.label}>Subject (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Chem review"
          placeholderTextColor={COLORS.textFaint}
          value={subject}
          onChangeText={setSubject}
        />

        <Text style={styles.hint}>
          They'll get this to accept or decline. When they accept, Google Calendar opens with the
          session pre-filled — one tap to save it.
        </Text>

        <Pressable style={styles.button} onPress={submit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Sending…' : 'Send invite'}</Text>
        </Pressable>
      </ScrollView>
    </View>
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
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 17,
    fontFamily: FONTS.regular,
    letterSpacing: 0.3,
  },
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
  chipText: { fontSize: 13, color: COLORS.text, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  selectedPill: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedPillText: { fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
});
