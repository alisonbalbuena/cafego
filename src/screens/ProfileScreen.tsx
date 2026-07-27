import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { StudySession } from '../types';
import { formatDuration } from '../utils/format';
import { getAllNighterTitle } from '../utils/allNighter';
import { COLORS, RADIUS } from '../theme';
import SpendingSection from '../components/SpendingSection';
import SessionHistorySection from '../components/SessionHistorySection';
import BuddyAdventureStrip from '../components/BuddyAdventureStrip';
import { useBuddyPosts } from '../hooks/useBuddyPosts';
import { useRefresh } from '../hooks/useRefresh';
import { UI_ICONS } from '../data/uiIcons';

interface Friend {
  uid: string;
  displayName: string;
}

export default function ProfileScreen({ navigation }: any) {
  const { user, profile, signOut } = useAuth();
  const { refreshing, onRefresh } = useRefresh();
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showFriends, setShowFriends] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const buddyPosts = useBuddyPosts(user ? [user.uid] : []);

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
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5);
  }, [completedSessions]);

  const cafesVisitedCount = useMemo(
    () => new Set(sessions.map((s) => s.cafeId)).size,
    [sessions]
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.menuButtonWrap, { top: insets.top + 8 }]}>
        <Pressable
          style={styles.menuButton}
          onPress={() => setShowMoreMenu((v) => !v)}
          hitSlop={10}
        >
          <Text style={styles.menuButtonText}>☰</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
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
        {!!profile?.community && (
          <View style={styles.communityRow}>
            <Image source={UI_ICONS.university} style={styles.communityIcon} resizeMode="contain" />
            <Text style={styles.community}>{profile.community}</Text>
          </View>
        )}
        {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        {!!getAllNighterTitle(profile?.allNighterCount ?? 0) && (
          <View style={styles.allNighterBadge}>
            <Text style={styles.allNighterBadgeText}>
              {getAllNighterTitle(profile?.allNighterCount ?? 0)!.emoji}{' '}
              {getAllNighterTitle(profile?.allNighterCount ?? 0)!.label} ·{' '}
              {profile?.allNighterCount} all-nighter{profile?.allNighterCount === 1 ? '' : 's'}
            </Text>
          </View>
        )}
        <Pressable onPress={() => setShowFriends(true)}>
          <Text style={styles.friendsCount}>{friends.length} friends</Text>
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

      <View style={styles.spendingHeaderRow}>
        <Image source={UI_ICONS.spending} style={styles.spendingHeaderIcon} resizeMode="contain" />
        <Text style={styles.sectionTitle}>Spending</Text>
      </View>
      <View style={{ marginBottom: 24 }}>
        <SpendingSection />
      </View>

      <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>🎒 Buddy adventures</Text>
      <View style={{ marginBottom: 24 }}>
        <BuddyAdventureStrip
          posts={buddyPosts}
          currentUid={user?.uid}
          emptyText="No buddy adventures yet — take yours out from the Coffee Friends tab or a check-in photo!"
        />
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Log out</Text>
      </Pressable>

      <Modal
        visible={showMoreMenu}
        animationType="slide"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.heading}>More</Text>

          <Pressable
            style={styles.moreSection}
            onPress={() => {
              setShowMoreMenu(false);
              navigation.navigate('EditProfile');
            }}
          >
            <View style={styles.moreSectionRow}>
              <Text style={styles.moreSectionTitle}>👤 Account</Text>
              <Text style={styles.moreSectionChevron}>›</Text>
            </View>
            <Text style={styles.moreSectionSubtext}>Edit profile</Text>
          </Pressable>

          <View style={styles.moreSection}>
            <Text style={styles.moreSectionTitle}>☕ Time by cafe</Text>
            {perCafe.length === 0 ? (
              <Text style={styles.emptyText}>No completed study sessions yet.</Text>
            ) : (
              perCafe.map((c, i) => (
                <View key={c.cafeId} style={styles.cafeRow}>
                  <View style={styles.cafeNameRow}>
                    {i === 0 && (
                      <Image
                        source={UI_ICONS.favoriteCafe}
                        style={styles.favoriteCafeIcon}
                        resizeMode="contain"
                      />
                    )}
                    <Text style={styles.cafeName}>
                      {i === 0 ? 'Favorite cafe · ' : ''}
                      {c.cafeName}
                    </Text>
                  </View>
                  <Text style={styles.cafeTime}>{formatDuration(c.ms)}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.moreSection}>
            <SessionHistorySection sessions={sessions} />
          </View>

          <Pressable style={styles.closeButton} onPress={() => setShowMoreMenu(false)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </ScrollView>
      </Modal>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  menuButtonWrap: { position: 'absolute', right: 16, zIndex: 10 },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonText: { fontSize: 18, color: COLORS.text },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.card },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  avatarPlaceholderText: { fontSize: 32, color: COLORS.textFaint, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  username: { fontSize: 13, color: COLORS.textFaint, marginTop: 2 },
  communityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  communityIcon: { width: 14, height: 14 },
  community: { fontSize: 12, color: COLORS.link, fontWeight: '600' },
  bio: { fontSize: 13, color: COLORS.text, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  allNighterBadge: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  allNighterBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  friendsCount: { fontSize: 14, color: COLORS.link, fontWeight: '600', marginTop: 8 },
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
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  spendingHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  spendingHeaderIcon: { width: 18, height: 18 },
  emptyText: { color: COLORS.textFaint, marginBottom: 12 },
  cafeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cafeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  favoriteCafeIcon: { width: 14, height: 14 },
  cafeName: { fontSize: 14, fontWeight: '600' },
  cafeTime: { fontSize: 14, color: COLORS.textMuted },
  signOutButton: { alignItems: 'center', marginTop: 24, marginBottom: 12 },
  signOutText: { color: COLORS.danger, fontWeight: '600', fontSize: 15 },
  modalContainer: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  // Each "More" panel item gets its own clearly bounded card with generous
  // spacing between them, so Account / Time by cafe / Session history read
  // as distinct blocks rather than one continuous list.
  moreSection: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 24,
  },
  moreSectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreSectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  moreSectionSubtext: { fontSize: 13, color: COLORS.link, fontWeight: '600' },
  moreSectionChevron: { fontSize: 22, color: COLORS.textFaint },
  friendRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  friendName: { fontSize: 16, fontWeight: '500' },
  closeButton: { alignItems: 'center', padding: 14, marginTop: 12 },
  closeButtonText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
});
