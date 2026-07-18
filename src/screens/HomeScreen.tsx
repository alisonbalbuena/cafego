import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ScrollView, StyleSheet } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CAFES } from '../data/cafes';
import { CafeAnnouncement, Cafe, StudySession } from '../types';

interface Friend {
  uid: string;
  displayName: string;
}

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriends, setActiveFriends] = useState<StudySession[]>([]);
  const [recentSessions, setRecentSessions] = useState<StudySession[]>([]);
  const [announcements, setAnnouncements] = useState<CafeAnnouncement[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snapshot) => setFriends(snapshot.docs.map((d) => d.data() as Friend))
    );
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (friends.length === 0) {
      setActiveFriends([]);
      return;
    }
    const uids = friends.slice(0, 30).map((f) => f.uid);
    const q = query(
      collection(db, 'studySessions'),
      where('uid', 'in', uids),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveFriends(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsubscribe;
  }, [friends]);

  useEffect(() => {
    if (!user) return;
    const uids = [user.uid, ...friends.slice(0, 29).map((f) => f.uid)];
    const q = query(collection(db, 'studySessions'), where('uid', 'in', uids));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as StudySession[];
      docs.sort((a, b) => b.startedAt - a.startedAt);
      setRecentSessions(docs.slice(0, 8));
    });
    return unsubscribe;
  }, [user, friends]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rewardAccounts'), where('uid', '==', user.uid));
    let innerUnsubscribe: (() => void) | null = null;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (innerUnsubscribe) {
        innerUnsubscribe();
        innerUnsubscribe = null;
      }
      const cafeIds = snapshot.docs.map((d) => (d.data() as any).cafeId as string);
      if (cafeIds.length === 0) {
        setAnnouncements([]);
        return;
      }
      const aq = query(
        collection(db, 'cafeAnnouncements'),
        where('cafeId', 'in', cafeIds.slice(0, 30))
      );
      innerUnsubscribe = onSnapshot(aq, (aSnapshot) => {
        const docs = aSnapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CafeAnnouncement[];
        docs.sort((a, b) => b.createdAt - a.createdAt);
        setAnnouncements(docs.slice(0, 8));
      });
    });
    return () => {
      unsubscribe();
      if (innerUnsubscribe) innerUnsubscribe();
    };
  }, [user]);

  const filteredCafes = useMemo(() => {
    if (!search.trim()) return [];
    const term = search.toLowerCase();
    return CAFES.filter(
      (c) => c.name.toLowerCase().includes(term) || c.neighborhood.toLowerCase().includes(term)
    );
  }, [search]);

  const openCafe = (cafe: Cafe) => {
    navigation.navigate('CafeProfile', { cafeId: cafe.id, cafeName: cafe.name });
  };

  if (search.trim()) {
    return (
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          placeholder="Search all cafes"
          value={search}
          onChangeText={setSearch}
          autoFocus
        />
        <FlatList
          data={filteredCafes}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>No cafes match your search.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.cafeRow} onPress={() => openCafe(item)}>
              <Text style={styles.cafeName}>{item.name}</Text>
              <Text style={styles.cafeNeighborhood}>{item.neighborhood}</Text>
            </Pressable>
          )}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Home</Text>

      <TextInput
        style={styles.input}
        placeholder="Search all cafes"
        value={search}
        onChangeText={setSearch}
      />

      <Text style={styles.sectionTitle}>Studying now</Text>
      {activeFriends.length === 0 ? (
        <Text style={styles.emptyText}>None of your friends are studying right now.</Text>
      ) : (
        activeFriends.map((s) => (
          <View key={s.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{s.displayName}</Text>
              <Text style={styles.rowSubtitle}>
                📍 {s.cafeName} · {s.subject}
              </Text>
            </View>
            <View style={styles.liveDot} />
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Recent sessions</Text>
      {recentSessions.length === 0 ? (
        <Text style={styles.emptyText}>No study sessions yet.</Text>
      ) : (
        recentSessions.map((s) => (
          <View key={s.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {s.uid === user?.uid ? 'You' : s.displayName} · {s.cafeName}
              </Text>
              <Text style={styles.rowSubtitle}>
                {s.subject} · {new Date(s.startedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Announcements</Text>
      {announcements.length === 0 ? (
        <Text style={styles.emptyText}>
          Visit a cafe with a rewards program to see their announcements here.
        </Text>
      ) : (
        announcements.map((a) => (
          <View key={a.id} style={styles.announcementCard}>
            <Text style={styles.announcementCafe}>{a.cafeName}</Text>
            <Text style={styles.announcementMessage}>{a.message}</Text>
            <Text style={styles.announcementDate}>
              {new Date(a.createdAt).toLocaleDateString()}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptyText: { color: '#999', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2a7a2a' },
  announcementCard: { backgroundColor: '#f6f6f6', borderRadius: 12, padding: 14, marginBottom: 10 },
  announcementCafe: { fontSize: 13, fontWeight: '700' },
  announcementMessage: { fontSize: 13, marginTop: 4 },
  announcementDate: { fontSize: 11, color: '#999', marginTop: 6 },
  cafeRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cafeName: { fontSize: 15, fontWeight: '500' },
  cafeNeighborhood: { fontSize: 12, color: '#888' },
});
