import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
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
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CAFES } from '../data/cafes';
import { Cafe, StudySession, Subject, SUBJECTS } from '../types';

export default function CheckInScreen() {
  const { user, signOut } = useAuth();
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'studySessions'),
      where('uid', '==', user.uid),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setActiveSession(null);
      } else {
        const d = snapshot.docs[0];
        setActiveSession({ id: d.id, ...(d.data() as any) });
      }
    });
    return unsubscribe;
  }, [user]);

  const filteredCafes = useMemo(() => {
    if (!search.trim()) return CAFES;
    const term = search.toLowerCase();
    return CAFES.filter(
      (c) =>
        c.name.toLowerCase().includes(term) || c.neighborhood.toLowerCase().includes(term)
    );
  }, [search]);

  const startSession = async () => {
    if (!user || !selectedCafe || !selectedSubject) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'studySessions'), {
        uid: user.uid,
        displayName: user.displayName ?? 'Someone',
        cafeId: selectedCafe.id,
        cafeName: selectedCafe.name,
        subject: selectedSubject,
        startedAt: Date.now(),
        endedAt: null,
      });
      setSelectedCafe(null);
      setSelectedSubject(null);
      setSearch('');
    } catch (err: any) {
      Alert.alert('Could not start session', err.message);
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
      });
    } catch (err: any) {
      Alert.alert('Could not end session', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (activeSession) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>You're studying</Text>
        <View style={styles.activeCard}>
          <Text style={styles.activeCafe}>{activeSession.cafeName}</Text>
          <Text style={styles.activeSubject}>{activeSession.subject}</Text>
        </View>
        <Pressable style={styles.dangerButton} onPress={endSession} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Ending…' : 'End session'}</Text>
        </Pressable>
        <Pressable onPress={signOut} style={{ marginTop: 24 }}>
          <Text style={styles.link}>Log out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Start a study session</Text>

      <Text style={styles.label}>Cafe</Text>
      {selectedCafe ? (
        <Pressable style={styles.selectedPill} onPress={() => setSelectedCafe(null)}>
          <Text style={styles.selectedPillText}>{selectedCafe.name} ✕</Text>
        </Pressable>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Search cafes (e.g. Duluth, Alchemist)"
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            style={styles.cafeList}
            data={filteredCafes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.cafeRow} onPress={() => setSelectedCafe(item)}>
                <Text style={styles.cafeName}>{item.name}</Text>
                <Text style={styles.cafeNeighborhood}>{item.neighborhood}</Text>
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

      <Pressable
        style={[
          styles.button,
          (!selectedCafe || !selectedSubject) && styles.buttonDisabled,
        ]}
        onPress={startSession}
        disabled={!selectedCafe || !selectedSubject || submitting}
      >
        <Text style={styles.buttonText}>
          {submitting ? 'Starting…' : 'Start studying'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  cafeList: { maxHeight: 220, marginBottom: 8 },
  cafeRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cafeName: { fontSize: 15, fontWeight: '500' },
  cafeNeighborhood: { fontSize: 12, color: '#888' },
  selectedPill: {
    backgroundColor: '#eef',
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
    borderColor: '#ddd',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelected: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextSelected: { color: '#fff' },
  button: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#ccc' },
  dangerButton: {
    backgroundColor: '#c0392b',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  activeCard: {
    backgroundColor: '#f6f6f6',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  activeCafe: { fontSize: 18, fontWeight: '700' },
  activeSubject: { fontSize: 14, color: '#666', marginTop: 4 },
  link: { color: '#555', textAlign: 'center' },
});
