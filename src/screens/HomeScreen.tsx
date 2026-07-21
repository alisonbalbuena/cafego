import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CAFES } from '../data/cafes';
import { CafeAnnouncement, Cafe, intensityMeta, isSessionPublic, StudySession } from '../types';
import { COLORS, RADIUS } from '../theme';
import SearchBar from '../components/SearchBar';
import StudyCalendarSection from '../components/StudyCalendarSection';
import NudgeBanner from '../components/NudgeBanner';
import MapPreview from '../components/MapPreview';
import CommunityFeedSection from '../components/CommunityFeedSection';
import { useRefresh } from '../hooks/useRefresh';

interface Friend {
  uid: string;
  displayName: string;
}

const MOTIVATIONAL_QUOTES = [
  'Time to grind ☕',
  'Work hard, play hard 💪',
  "Let's lock in 🔒",
  'Stay hungry, stay focused 🔥',
  'One session closer to greatness ✨',
  'No days off 📚',
  'Future you says thanks 🙏',
  'Get after it 🚀',
  'Small steps, big wins 👣',
  'Discipline over motivation 💯',
  'Progress, not perfection 📈',
  'You vs. you 🏆',
  'Turn coffee into knowledge ☕',
  "Let's make today count ⏳",
  'Chase the grind 🎯',
  'Consistency beats intensity 🌱',
  'Show up for yourself today 💫',
  'Big goals start with small sessions 🌟',
];

function randomQuote() {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
}

export default function HomeScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const { refreshing, onRefresh } = useRefresh();
  const [quote] = useState(randomQuote);
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
      const docs = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession)
        .filter(isSessionPublic);
      setActiveFriends(docs);
    });
    return unsubscribe;
  }, [friends]);

  useEffect(() => {
    if (!user) return;
    const uids = [user.uid, ...friends.slice(0, 29).map((f) => f.uid)];
    const q = query(collection(db, 'studySessions'), where('uid', 'in', uids));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession)
        .filter((s) => s.uid === user.uid || isSessionPublic(s));
      docs.sort((a, b) => b.startedAt - a.startedAt);
      setRecentSessions(docs.slice(0, 5));
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
        <SearchBar
          style={{ marginBottom: 16 }}
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
              <View style={styles.cafeIconBubble}>
                <Ionicons name="cafe" size={16} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cafeName}>{item.name}</Text>
                <Text style={styles.cafeNeighborhood}>{item.neighborhood}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
            </Pressable>
          )}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      <Text style={styles.greeting}>{quote}</Text>
      <Text style={styles.heading}>
        {profile?.firstName ?? profile?.displayName ?? 'Welcome back'}
      </Text>

      <NudgeBanner />

      <SearchBar
        style={{ marginBottom: 16 }}
        placeholder="Search all cafes"
        value={search}
        onChangeText={setSearch}
      />

      <MapPreview onPress={() => navigation.navigate('Map')} />

      <Pressable style={styles.mapButton} onPress={() => navigation.navigate('Map')}>
        <View style={styles.mapButtonIcon}>
          <Ionicons name="map" size={18} color={COLORS.white} />
        </View>
        <Text style={styles.mapButtonText}>View map — nearby cafes & friends</Text>
        <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
      </Pressable>

      <View style={styles.sectionHeaderRow}>
        <Ionicons name="people" size={16} color={COLORS.textMuted} />
        <Text style={styles.sectionTitle}>Studying now</Text>
      </View>
      <View style={styles.card}>
        {activeFriends.length === 0 ? (
          <Text style={styles.emptyText}>None of your friends are studying right now.</Text>
        ) : (
          activeFriends.map((s, i) => (
            <View key={s.id} style={[styles.row, i === activeFriends.length - 1 && styles.rowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{s.displayName}</Text>
                <Text style={styles.rowSubtitle}>
                  📍 {s.cafeName} · {s.subject}
                </Text>
                <View style={styles.intensityPill}>
                  <Text style={styles.intensityPillText}>
                    {intensityMeta(s.intensity).emoji} {intensityMeta(s.intensity).label}
                  </Text>
                </View>
              </View>
              <View style={styles.liveDot} />
            </View>
          ))
        )}
      </View>

      <CommunityFeedSection />

      <View style={styles.sectionHeaderRow}>
        <Ionicons name="time" size={16} color={COLORS.textMuted} />
        <Text style={styles.sectionTitle}>Recent sessions</Text>
      </View>
      <View style={styles.card}>
        {recentSessions.length === 0 ? (
          <Text style={styles.emptyText}>No study sessions yet.</Text>
        ) : (
          recentSessions.map((s, i) => (
            <View key={s.id} style={[styles.row, i === recentSessions.length - 1 && styles.rowLast]}>
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
      </View>

      <View style={styles.sectionHeaderRow}>
        <Ionicons name="calendar" size={16} color={COLORS.textMuted} />
        <Text style={styles.sectionTitle}>Your study log</Text>
      </View>
      <StudyCalendarSection />

      <View style={styles.sectionHeaderRow}>
        <Ionicons name="megaphone" size={16} color={COLORS.textMuted} />
        <Text style={styles.sectionTitle}>Announcements</Text>
      </View>
      {announcements.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            Visit a cafe with a rewards program to see their announcements here.
          </Text>
        </View>
      ) : (
        announcements.map((a) => (
          <Pressable
            key={a.id}
            style={styles.announcementCard}
            onPress={() =>
              navigation.navigate('CafeProfile', { cafeId: a.cafeId, cafeName: a.cafeName })
            }
          >
            <Text style={styles.announcementCafe}>{a.cafeName}</Text>
            <Text style={styles.announcementMessage}>{a.message}</Text>
            <Text style={styles.announcementDate}>
              {new Date(a.createdAt).toLocaleDateString()}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  greeting: { fontSize: 19, fontWeight: '700', color: COLORS.accent, marginBottom: 2 },
  heading: { fontSize: 34, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 8,
  },
  mapButtonIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapButtonText: { color: COLORS.white, fontWeight: '600', fontSize: 14, flex: 1 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
  },
  emptyText: { color: COLORS.textFaint, paddingVertical: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  rowSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  intensityPill: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  intensityPillText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },
  announcementCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
  },
  announcementCafe: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  announcementMessage: { fontSize: 13, marginTop: 4, color: COLORS.text },
  announcementDate: { fontSize: 11, color: COLORS.textFaint, marginTop: 6 },
  cafeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cafeIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cafeName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  cafeNeighborhood: { fontSize: 12, color: COLORS.textMuted },
});
