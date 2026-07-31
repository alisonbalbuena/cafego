import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { useBuddyPosts } from '../hooks/useBuddyPosts';
import { StudySession, UserProfile } from '../types';
import { formatDuration, formatMoney } from '../utils/format';
import { getAllNighterTitle } from '../utils/allNighter';
import { COLORS, RADIUS, FONTS } from '../theme';
import { UI_ICONS } from '../data/uiIcons';
import SpendingSection from '../components/SpendingSection';
import BuddyAdventureStrip from '../components/BuddyAdventureStrip';
import BackButton from '../components/BackButton';

/** Read-only view of another user's profile — reached by tapping their name
 * from the Friends list, leaderboard, or a buddy post/comment. Budget,
 * Screen Time, and detailed spending only render if that person has opted
 * in via the "Visible to friends" toggle on their own Profile screen. */
export default function FriendProfileScreen({ route, navigation }: any) {
  const { uid } = route.params as { uid: string };
  const { user: viewer } = useAuth();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const buddyPosts = useBuddyPosts([uid]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', uid), (snapshot) => {
      setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
    });
    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    const q = query(collection(db, 'studySessions'), where('uid', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession));
    });
    return unsubscribe;
  }, [uid]);

  const completedSessions = useMemo(() => sessions.filter((s) => s.endedAt != null), [sessions]);
  const totalMs = useMemo(
    () => completedSessions.reduce((sum, s) => sum + (s.endedAt! - s.startedAt), 0),
    [completedSessions]
  );
  const cafesVisitedCount = useMemo(
    () => new Set(completedSessions.map((s) => s.cafeId)).size,
    [completedSessions]
  );

  const allNighterTitle = getAllNighterTitle(profile?.allNighterCount ?? 0);
  const showStreak = profile?.streakVisibility === 'friends' && (profile?.weeklyStreak ?? 0) > 0;

  if (!profile) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 12 }]}>
        <View style={styles.backButtonWrap}>
          <BackButton navigation={navigation} />
        </View>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.backButtonWrap, { top: insets.top + 12 }]}>
        <BackButton navigation={navigation} />
      </View>

      <View style={styles.header}>
        {profile.photoUrl ? (
          <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarPlaceholderText}>
              {(profile.firstName ?? profile.displayName ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{profile.displayName}</Text>
        {!!profile.username && <Text style={styles.username}>@{profile.username}</Text>}
        {!!profile.community && (
          <View style={styles.communityRow}>
            <Image source={UI_ICONS.university} style={styles.communityIcon} resizeMode="contain" />
            <Text style={styles.community}>{profile.community}</Text>
          </View>
        )}
        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        {!!allNighterTitle && (
          <View style={styles.allNighterBadge}>
            <Text style={styles.allNighterBadgeText}>
              {allNighterTitle.emoji} {allNighterTitle.label} · {profile.allNighterCount} all-nighter
              {profile.allNighterCount === 1 ? '' : 's'}
            </Text>
          </View>
        )}
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

      {showStreak && (
        <View style={styles.streakRow}>
          <Image source={UI_ICONS.streak} style={styles.streakIcon} resizeMode="contain" />
          <Text style={styles.streakText}>{profile.weeklyStreak} week streak</Text>
        </View>
      )}

      <View style={styles.sectionHeaderRow}>
        <Image source={UI_ICONS.backpack} style={styles.sectionHeaderIcon} resizeMode="contain" />
        <Text style={styles.sectionTitle}>Buddy adventures</Text>
      </View>
      <View style={{ marginBottom: 24 }}>
        <BuddyAdventureStrip
          posts={buddyPosts}
          currentUid={viewer?.uid}
          currentDisplayName={viewer?.displayName ?? 'Someone'}
          emptyText={`${profile.displayName} hasn't taken their buddy on any adventures yet.`}
        />
      </View>

      {profile.spendingVisibility === 'public' && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Image source={UI_ICONS.spending} style={styles.sectionHeaderIcon} resizeMode="contain" />
            <Text style={styles.sectionTitle}>Spending</Text>
          </View>
          <View style={{ marginBottom: 24 }}>
            <SpendingSection uid={uid} />
          </View>
        </>
      )}

      {profile.budgetVisibility === 'public' && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Image source={UI_ICONS.spending} style={styles.cardTitleIcon} resizeMode="contain" />
            <Text style={styles.cardTitle}>Spending budget</Text>
          </View>
          {profile.budgetAmount != null ? (
            <Text style={styles.cardValue}>
              {formatMoney(profile.budgetAmount)} / {profile.budgetPeriod ?? 'weekly'}
            </Text>
          ) : (
            <Text style={styles.cardHint}>No budget set.</Text>
          )}
        </View>
      )}

      {profile.screenTimeVisibility === 'public' && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Image source={UI_ICONS.screenTime} style={styles.cardTitleIcon} resizeMode="contain" />
            <Text style={styles.cardTitle}>Screen time</Text>
          </View>
          <Text style={styles.cardValue}>
            {profile.screenTimeShieldEnabled ? 'Shield is on' : 'Shield is off'}
          </Text>
        </View>
      )}

      {profile.budgetVisibility !== 'public' &&
        profile.screenTimeVisibility !== 'public' &&
        profile.spendingVisibility !== 'public' && (
          <Text style={styles.privateHint}>
            {profile.displayName} keeps their budget, screen time, and spending details private.
          </Text>
        )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingTop: 60 },
  center: { alignItems: 'center', justifyContent: 'center' },
  backButtonWrap: { position: 'absolute', left: 20, zIndex: 1 },
  header: { alignItems: 'center', marginBottom: 20, marginTop: 40 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.card },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { fontSize: 32, fontWeight: '700', color: COLORS.primary, fontFamily: FONTS.bold },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 10, fontFamily: FONTS.bold, letterSpacing: 0.6 },
  username: { fontSize: 13, color: COLORS.textMuted, marginTop: 2, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  communityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  communityIcon: { width: 14, height: 14 },
  community: { fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  bio: { fontSize: 13, color: COLORS.text, marginTop: 8, textAlign: 'center', fontFamily: FONTS.regular, letterSpacing: 0.3 },
  allNighterBadge: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  allNighterBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.primary, fontFamily: FONTS.semiBold, letterSpacing: 0.3 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.7 },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginBottom: 16,
  },
  streakIcon: { width: 16, height: 16 },
  streakText: { fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.3 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionHeaderIcon: { width: 18, height: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, fontFamily: FONTS.bold, letterSpacing: 0.7 },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 16,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardTitleIcon: { width: 16, height: 16 },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.5,
  },
  cardValue: { fontSize: 14, color: COLORS.text, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  cardHint: { fontSize: 13, color: COLORS.textFaint, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  privateHint: {
    fontSize: 12,
    color: COLORS.textFaint,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: FONTS.regular,
    letterSpacing: 0.3,
  },
});
