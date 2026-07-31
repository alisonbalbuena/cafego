import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Switch,
  StyleSheet,
  Platform,
} from 'react-native';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { StudySession } from '../types';
import { formatDuration } from '../utils/format';
import { getAllNighterTitle } from '../utils/allNighter';
import { showAlert } from '../utils/alert';
import { ensureCalendarPermission } from '../utils/calendarSync';
import {
  hasSelection,
  isScreenTimeSupported,
  presentActivityPicker,
  requestAuthorization,
} from 'screen-time';
import { COLORS, RADIUS, FONTS } from '../theme';
import SpendingSection from '../components/SpendingSection';
import SessionHistorySection from '../components/SessionHistorySection';
import BuddyAdventureStrip from '../components/BuddyAdventureStrip';
import FeatureTip from '../components/FeatureTip';
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
  const [budgetAmount, setBudgetAmount] = useState(
    profile?.budgetAmount != null ? String(profile.budgetAmount) : ''
  );
  const [budgetPeriod, setBudgetPeriod] = useState<'weekly' | 'monthly'>(
    profile?.budgetPeriod ?? 'weekly'
  );
  const [calendarLogging, setCalendarLogging] = useState(profile?.calendarLogging ?? false);
  const [screenTimeShieldEnabled, setScreenTimeShieldEnabled] = useState(
    profile?.screenTimeShieldEnabled ?? false
  );
  const [budgetVisibility, setBudgetVisibility] = useState<'private' | 'public'>(
    profile?.budgetVisibility ?? 'private'
  );
  const [screenTimeVisibility, setScreenTimeVisibility] = useState<'private' | 'public'>(
    profile?.screenTimeVisibility ?? 'private'
  );
  const [spendingVisibility, setSpendingVisibility] = useState<'private' | 'public'>(
    profile?.spendingVisibility ?? 'private'
  );

  const toggleFieldVisibility = async (
    field: 'budgetVisibility' | 'screenTimeVisibility' | 'spendingVisibility',
    setter: (v: 'private' | 'public') => void,
    makePublic: boolean
  ) => {
    if (!user) return;
    const value = makePublic ? 'public' : 'private';
    setter(value);
    try {
      await updateDoc(doc(db, 'users', user.uid), { [field]: value });
    } catch (err: any) {
      setter(makePublic ? 'private' : 'public');
      showAlert('Could not update setting', err.message);
    }
  };

  const savePeriod = async (next: 'weekly' | 'monthly') => {
    if (!user) return;
    setBudgetPeriod(next);
    try {
      await updateDoc(doc(db, 'users', user.uid), { budgetPeriod: next });
    } catch (err: any) {
      showAlert('Could not update setting', err.message);
    }
  };

  const saveBudgetAmount = async () => {
    if (!user) return;
    const parsed = Number(budgetAmount);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        budgetAmount: budgetAmount.trim() && parsed > 0 ? parsed : null,
      });
    } catch (err: any) {
      showAlert('Could not update setting', err.message);
    }
  };

  // Saved immediately (not behind a Save button) because enabling has to run
  // the calendar permission prompt right then — that's the "connect" step.
  const toggleCalendarLogging = async (next: boolean) => {
    if (!user) return;
    if (next) {
      if (Platform.OS === 'web') {
        showAlert('Not available on web', 'Calendar logging works from the mobile app.');
        return;
      }
      const granted = await ensureCalendarPermission();
      if (!granted) {
        showAlert(
          'Calendar access needed',
          'Allow calendar access so finished study sessions can be added automatically.'
        );
        return;
      }
    }
    setCalendarLogging(next);
    try {
      await updateDoc(doc(db, 'users', user.uid), { calendarLogging: next });
    } catch (err: any) {
      setCalendarLogging(!next);
      showAlert('Could not update setting', err.message);
    }
  };

  // Enabling has to run the Screen Time consent prompt and (the first time)
  // the app picker right then — that's the "connect" step, same idea as
  // calendar logging above.
  const toggleScreenTimeShield = async (next: boolean) => {
    if (!user) return;
    if (next) {
      if (!isScreenTimeSupported()) {
        showAlert(
          'Not available here',
          'Screen Time shielding needs the iOS build with Screen Time enabled — not Expo Go or web.'
        );
        return;
      }
      const authorized = await requestAuthorization();
      if (!authorized) {
        showAlert(
          'Screen Time access needed',
          'Allow Screen Time access so distracting apps can be shielded during your sessions.'
        );
        return;
      }
      if (!hasSelection()) {
        const picked = await presentActivityPicker();
        if (!picked) return;
      }
    }
    setScreenTimeShieldEnabled(next);
    try {
      await updateDoc(doc(db, 'users', user.uid), { screenTimeShieldEnabled: next });
    } catch (err: any) {
      setScreenTimeShieldEnabled(!next);
      showAlert('Could not update setting', err.message);
    }
  };

  const chooseShieldedApps = async () => {
    if (!isScreenTimeSupported()) {
      showAlert(
        'Not available here',
        'Screen Time shielding needs the iOS build with Screen Time enabled — not Expo Go or web.'
      );
      return;
    }
    await presentActivityPicker();
  };

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

      <FeatureTip
        id="spending-budget"
        title="💰 Keep an eye on cafe spending"
        body="Set a weekly or monthly budget and we'll give you a friendly heads-up when you're over it after a session — nothing is blocked, it's just a nudge to help you notice."
        highlight
      />
      <View style={styles.moreSection}>
        <View style={styles.moreSectionTitleRow}>
          <Image source={UI_ICONS.spending} style={styles.moreSectionTitleIcon} resizeMode="contain" />
          <Text style={styles.moreSectionTitle}>Spending budget</Text>
        </View>
        <View style={styles.periodRow}>
          <Pressable
            style={[styles.periodChip, budgetPeriod === 'weekly' && styles.periodChipSelected]}
            onPress={() => savePeriod('weekly')}
          >
            <Text
              style={[
                styles.periodChipText,
                budgetPeriod === 'weekly' && styles.periodChipTextSelected,
              ]}
            >
              Weekly
            </Text>
          </Pressable>
          <Pressable
            style={[styles.periodChip, budgetPeriod === 'monthly' && styles.periodChipSelected]}
            onPress={() => savePeriod('monthly')}
          >
            <Text
              style={[
                styles.periodChipText,
                budgetPeriod === 'monthly' && styles.periodChipTextSelected,
              ]}
            >
              Monthly
            </Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.budgetInput}
          value={budgetAmount}
          onChangeText={setBudgetAmount}
          onBlur={saveBudgetAmount}
          keyboardType="decimal-pad"
          placeholder="e.g. 40"
          placeholderTextColor={COLORS.textFaint}
        />
        <Text style={styles.moreSectionHint}>
          We'll show a friendly reminder of how much you have left when you start a session —
          just a nudge, never a limit.
        </Text>
        <View style={styles.visibilityRow}>
          <Text style={styles.visibilityLabel}>Visible to friends</Text>
          <Switch
            value={budgetVisibility === 'public'}
            onValueChange={(v) => toggleFieldVisibility('budgetVisibility', setBudgetVisibility, v)}
            trackColor={{ true: COLORS.primary }}
          />
        </View>
      </View>

      <FeatureTip
        id="screen-time"
        title="🔒 Stay off your phone while you study"
        body="Turn this on once, pick the apps that distract you, and they'll be shielded automatically for the whole time you're checked into a session — no manual locking needed. Requires a real iOS device, not the Simulator."
        highlight
      />
      {!screenTimeShieldEnabled && (
        <View style={styles.screenTimeReminderBanner}>
          <Text style={styles.screenTimeReminderText}>
            ⚠️ MAKE SURE TO TOGGLE ON AND CHOOSE APPS TO RESTRICT
          </Text>
        </View>
      )}
      <View style={styles.moreSection}>
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <View style={styles.moreSectionTitleRow}>
              <Image source={UI_ICONS.screenTime} style={styles.moreSectionTitleIcon} resizeMode="contain" />
              <Text style={styles.moreSectionTitle}>Screen time</Text>
            </View>
            <Text style={styles.moreSectionHint}>
              Pick apps that tempt you away — they'll be blocked with Screen Time's shield
              while you're checked in, and unlocked the moment you end the session.
            </Text>
          </View>
          <Switch
            value={screenTimeShieldEnabled}
            onValueChange={toggleScreenTimeShield}
            trackColor={{ true: COLORS.primary }}
          />
        </View>
        {screenTimeShieldEnabled && (
          <Pressable style={styles.secondaryButton} onPress={chooseShieldedApps}>
            <Text style={styles.secondaryButtonText}>Change shielded apps</Text>
          </Pressable>
        )}
        <View style={styles.visibilityRow}>
          <Text style={styles.visibilityLabel}>Visible to friends</Text>
          <Switch
            value={screenTimeVisibility === 'public'}
            onValueChange={(v) =>
              toggleFieldVisibility('screenTimeVisibility', setScreenTimeVisibility, v)
            }
            trackColor={{ true: COLORS.primary }}
          />
        </View>
      </View>

      <View style={styles.spendingHeaderRow}>
        <Image source={UI_ICONS.spending} style={styles.spendingHeaderIcon} resizeMode="contain" />
        <Text style={styles.sectionTitle}>Spending</Text>
      </View>
      <View style={styles.visibilityRow}>
        <Text style={styles.visibilityLabel}>Visible to friends</Text>
        <Switch
          value={spendingVisibility === 'public'}
          onValueChange={(v) => toggleFieldVisibility('spendingVisibility', setSpendingVisibility, v)}
          trackColor={{ true: COLORS.primary }}
        />
      </View>
      <View style={{ marginBottom: 24 }}>
        <SpendingSection />
      </View>

      <View style={styles.spendingHeaderRow}>
        <Image source={UI_ICONS.backpack} style={styles.spendingHeaderIcon} resizeMode="contain" />
        <Text style={styles.sectionTitle}>Buddy adventures</Text>
      </View>
      <View style={{ marginBottom: 24 }}>
        <BuddyAdventureStrip
          posts={buddyPosts}
          currentUid={user?.uid}
          currentDisplayName={user?.displayName ?? 'Someone'}
          allowDeletePost
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
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.moreSectionTitle}>📅 Log sessions to calendar</Text>
                <Text style={styles.moreSectionHint}>
                  Finished study sessions are added to your device calendar automatically — if it
                  syncs with Google Calendar, they'll show up there too.
                </Text>
              </View>
              <Switch
                value={calendarLogging}
                onValueChange={toggleCalendarLogging}
                trackColor={{ true: COLORS.primary }}
              />
            </View>
          </View>

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
              <Pressable
                style={styles.friendRow}
                onPress={() => {
                  setShowFriends(false);
                  navigation.navigate('FriendProfile', { uid: item.uid });
                }}
              >
                <Text style={styles.friendName}>{item.displayName}</Text>
              </Pressable>
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
  menuButtonText: { fontSize: 18, color: COLORS.text, fontFamily: FONTS.regular },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.card },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  avatarPlaceholderText: { fontSize: 32, color: COLORS.textFaint, fontWeight: '700', fontFamily: FONTS.semiBold },
  name: { fontSize: 20, fontWeight: '700', marginTop: 12, fontFamily: FONTS.semiBold, letterSpacing: 0.8 },
  username: { fontSize: 13, color: COLORS.textFaint, marginTop: 2, fontFamily: FONTS.regular, letterSpacing: 0.4 },
  communityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  communityIcon: { width: 14, height: 14 },
  community: { fontSize: 12, color: COLORS.link, fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.3 },
  bio: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontFamily: FONTS.regular,
    letterSpacing: 0.4,
  },
  allNighterBadge: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  allNighterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.3,
  },
  friendsCount: {
    fontSize: 14,
    color: COLORS.link,
    fontWeight: '600',
    marginTop: 8,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.4,
  },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700', fontFamily: FONTS.semiBold, letterSpacing: 0.8 },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  sectionTitle: { fontSize: 15, fontWeight: '700', fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  spendingHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  spendingHeaderIcon: { width: 18, height: 18 },
  emptyText: { color: COLORS.textFaint, marginBottom: 12, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  cafeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cafeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  favoriteCafeIcon: { width: 14, height: 14 },
  cafeName: { fontSize: 14, fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  cafeTime: { fontSize: 14, color: COLORS.textMuted, fontFamily: FONTS.regular, letterSpacing: 0.4 },
  signOutButton: { alignItems: 'center', marginTop: 24, marginBottom: 12 },
  signOutText: {
    color: COLORS.danger,
    fontWeight: '600',
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.5,
  },
  modalContainer: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 20, fontFamily: FONTS.bold, letterSpacing: 1.0 },
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
  screenTimeReminderBanner: {
    backgroundColor: '#ffd54a',
    borderWidth: 2,
    borderColor: '#c99a1f',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  screenTimeReminderText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3d2b1f',
    textAlign: 'center',
    fontFamily: FONTS.bold,
    letterSpacing: 0.4,
  },
  moreSectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  moreSectionTitleIcon: { width: 18, height: 18 },
  moreSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.6,
  },
  moreSectionSubtext: {
    fontSize: 13,
    color: COLORS.link,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.4,
  },
  moreSectionChevron: { fontSize: 22, color: COLORS.textFaint, fontFamily: FONTS.regular },
  moreSectionHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
    fontFamily: FONTS.regular,
    letterSpacing: 0.3,
  },
  periodRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  periodChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  periodChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodChipText: { fontSize: 13, color: COLORS.text, fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  periodChipTextSelected: { color: '#fff' },
  budgetInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTextWrap: { flex: 1 },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  visibilityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: COLORS.text, fontWeight: '600', fontSize: 13, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  friendRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  friendName: { fontSize: 16, fontWeight: '500', fontFamily: FONTS.medium, letterSpacing: 0.4 },
  closeButton: { alignItems: 'center', padding: 14, marginTop: 12 },
  closeButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.5,
  },
});
