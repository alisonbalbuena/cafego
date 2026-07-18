import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { StudySession } from '../types';
import { formatDuration } from '../utils/format';
import { COLORS } from '../theme';
import SpendingSection from '../components/SpendingSection';

interface Friend {
  uid: string;
  displayName: string;
}

export default function ProfileScreen({ navigation }: any) {
  const { user, profile, signOut } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showFriends, setShowFriends] = useState(false);
  const [sessions, setSessions] = useState<StudySession[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snapshot) => setFriends(snapshot.docs.map((d) => d.data() as Friend))
    );
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'studySessions'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsubscribe;
  }, [user]);

  const completedSessions = useMemo(() => sessions.filter((s) => s.endedAt != null), [sessions]);

  const totalMs = useMemo(
    () => completedSessions.reduce((sum, s) => sum + (s.endedAt! - s.startedAt), 0),
    [completedSessions]
  );

  const perCafe = useMemo(() => {
    const map: Record<string, { cafeName: string; ms: number }> = {};
    completedSessions.forEach((s) => {
      if (!map[s.cafeId]) map[s.cafeId] = { cafeName: s.cafeName, ms: 0 };
      map[s.cafeId].ms += s.endedAt! - s.startedAt;
    });
    return Object.entries(map)
      .map(([cafeId, v]) => ({ cafeId, ...v }))
      .sort((a, b) => b.ms - a.ms);
  }, [completedSessions]);

  const cafesVisitedCount = useMemo(
    () => new Set(sessions.map((s) => s.cafeId)).size,
    [sessions]
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {profile?.photoUrl ? (
          <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarPlaceholderText}>
              {(profile?.firstName ?? user?.displayName ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{profile?.displayName ?? user?.displayName}</Text>
        {!!profile?.username && <Text style={styles.username}>@{profile.username}</Text>}
        {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        <Pressable onPress={() => setShowFriends(true)}>
          <Text style={styles.friendsCount}>{friends.length} friends</Text>
        </Pressable>
        <Pressable style={styles.editButton} onPress={() => navigation.navigate('EditProfile')}>
          <Text style={styles.editButtonText}>Edit profile</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatDuration(totalMs)}</Text>
          <Text style={styles.statLabel}>Total studied</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{cafesVisitedCount}</Text>
          <Text style={styles.statLabel}>Cafes visited</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>💵 Spending</Text>
      <View style={{ marginBottom: 24 }}>
        <SpendingSection />
      </View>

      <Text style={styles.sectionTitle}>Time by cafe</Text>
      {perCafe.length === 0 ? (
        <Text style={styles.emptyText}>No completed study sessions yet.</Text>
      ) : (
        perCafe.map((c) => (
          <View key={c.cafeId} style={styles.cafeRow}>
            <Text style={styles.cafeName}>{c.cafeName}</Text>
            <Text style={styles.cafeTime}>{formatDuration(c.ms)}</Text>
          </View>
        ))
      )}

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Log out</Text>
      </Pressable>

      <Modal
        visible={showFriends}
        animationType="slide"
        onRequestClose={() => setShowFriends(false)}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.heading}>Friends</Text>
          <FlatList
            data={friends}
            keyExtractor={(f) => f.uid}
            ListEmptyComponent={<Text style={styles.emptyText}>No friends yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.friendRow}>
                <Text style={styles.friendName}>{item.displayName}</Text>
              </View>
            )}
          />
          <Pressable style={styles.closeButton} onPress={() => setShowFriends(false)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.card },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  avatarPlaceholderText: { fontSize: 32, color: COLORS.textFaint, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  username: { fontSize: 13, color: COLORS.textFaint, marginTop: 2 },
  bio: { fontSize: 13, color: COLORS.text, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  friendsCount: { fontSize: 14, color: COLORS.link, fontWeight: '600', marginTop: 8 },
  editButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  editButtonText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: COLORS.textFaint, marginBottom: 12 },
  cafeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cafeName: { fontSize: 14, fontWeight: '600' },
  cafeTime: { fontSize: 14, color: COLORS.textMuted },
  signOutButton: { alignItems: 'center', marginTop: 24, marginBottom: 12 },
  signOutText: { color: COLORS.danger, fontWeight: '600', fontSize: 15 },
  modalContainer: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  friendRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  friendName: { fontSize: 16, fontWeight: '500' },
  closeButton: { alignItems: 'center', padding: 14, marginTop: 12 },
  closeButtonText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
});
