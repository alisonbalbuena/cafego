import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import DismissKeyboardView from '../components/DismissKeyboardView';
import { arrayUnion, collection, doc, increment, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import {
  COFFEE_EXPRESSIONS,
  COFFEE_FRIENDS,
  CoffeeExpression,
  CoffeeFriend,
  CoffeeFriendCategory,
  DEFAULT_COFFEE_FRIEND_ID,
  getCoffeeExpression,
  getCoffeeFriend,
  getCoffeeFriendImage,
} from '../data/coffeeFriends';
import { PET_BACKGROUND_ITEMS, PetBackground, getPetBackground } from '../data/petItems';
import { UI_ICONS } from '../data/uiIcons';
import { randomBuddyPose } from '../data/buddyPoses';
import BuddyPhotoEditor, { BuddyPhotoResult } from '../components/BuddyPhotoEditor';
import { postBuddyAdventure } from '../utils/buddyPosts';
import { showAlert } from '../utils/alert';
import { useRefresh } from '../hooks/useRefresh';
import { getCombinedMultiplier } from '../utils/streakCoins';
import {
  BUDDY_ACCESSORIES,
  getAccessoryContext,
  getUnlockedAccessories,
} from '../utils/buddyJourney';
import { StudySession } from '../types';
import { COLORS, RADIUS } from '../theme';

const COIN_ICON = require('../../assets/bean-coin.png');

// One buddy, one name — it's the same buddy growing/evolving through
// different coffee/tea/smoothie forms, so the name is global (profile.buddyName)
// rather than tied to whichever form is currently active. Renaming is free
// the first couple times, then costs coins; the collection grid below still
// always shows each form's own canonical name, never this personal name.
const FREE_NAME_CHANGES = 2;
const RENAME_COST_COINS = 10;

const CATEGORY_FILTERS: { value: CoffeeFriendCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'tea', label: 'Tea' },
  { value: 'smoothie', label: 'Smoothie' },
];

export default function PetScreen() {
  const { user, profile } = useAuth();
  const { refreshing, onRefresh } = useRefresh();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CoffeeFriendCategory | 'all'>('all');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [adventurePhotoUri, setAdventurePhotoUri] = useState<string | null>(null);
  const [adventureEditorVisible, setAdventureEditorVisible] = useState(false);
  const [adventurePoseId, setAdventurePoseId] = useState('idle');
  const [savingAdventure, setSavingAdventure] = useState(false);
  const [pendingAdventureResult, setPendingAdventureResult] = useState<BuddyPhotoResult | null>(null);
  const [adventureLocation, setAdventureLocation] = useState('');
  const [adventureCaption, setAdventureCaption] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'studySessions'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession));
    });
    return unsubscribe;
  }, [user]);

  const accessoryContext = useMemo(
    () => getAccessoryContext(profile, sessions),
    [profile, sessions]
  );
  const unlockedAccessoryIds = useMemo(
    () => new Set(getUnlockedAccessories(accessoryContext).map((a) => a.id)),
    [accessoryContext]
  );

  const coins = profile?.petCoins ?? 0;
  const weeklyStreak = profile?.weeklyStreak ?? 0;
  const streakMultiplier = getCombinedMultiplier(weeklyStreak);
  const streakVisibility = profile?.streakVisibility ?? 'private';

  const unlockedFriends = useMemo(
    () => new Set(profile?.unlockedCoffeeFriends ?? [DEFAULT_COFFEE_FRIEND_ID]),
    [profile?.unlockedCoffeeFriends]
  );
  const activeFriend = getCoffeeFriend(profile?.activeCoffeeFriend) ?? COFFEE_FRIENDS[0];
  const unlockedExpressions = useMemo(
    () => new Set(profile?.unlockedExpressions ?? []),
    [profile?.unlockedExpressions]
  );
  const activeExpression = getCoffeeExpression(profile?.activeExpression);
  // The buddy is one identity that just changes form as you unlock new
  // coffees/teas/smoothies — so its name is a single profile-level field, not
  // tied to whichever character skin happens to be active right now.
  const buddyName = profile?.buddyName ?? activeFriend.name;
  const nameChangesUsed = profile?.coffeeNameChangesUsed ?? 0;
  const freeRenamesLeft = Math.max(0, FREE_NAME_CHANGES - nameChangesUsed);

  const ownedBackgrounds = useMemo(
    () => new Set(['default', ...(profile?.petBackgroundsOwned ?? [])]),
    [profile?.petBackgroundsOwned]
  );
  const activeBackground = getPetBackground(profile?.petBackground);

  const visibleFriends = useMemo(
    () =>
      categoryFilter === 'all'
        ? COFFEE_FRIENDS
        : COFFEE_FRIENDS.filter((f) => f.category === categoryFilter),
    [categoryFilter]
  );

  const setStreakVisibility = async (visibility: 'private' | 'friends') => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { streakVisibility: visibility });
    } catch (err: any) {
      showAlert('Could not update streak visibility', err.message);
    }
  };

  const startRename = () => {
    setNameDraft(buddyName);
    setEditingName(true);
  };

  const saveRename = async () => {
    if (!user) return;
    const clean = nameDraft.trim().slice(0, 20);
    setEditingName(false);
    if (!clean || clean === buddyName) return;
    const usingFreeRename = freeRenamesLeft > 0;
    if (!usingFreeRename && coins < RENAME_COST_COINS) {
      showAlert(
        'Out of free renames',
        `You've used your ${FREE_NAME_CHANGES} free renames. Renaming again costs ${RENAME_COST_COINS} coins — you have ${coins.toFixed(1)}.`
      );
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        buddyName: clean,
        coffeeNameChangesUsed: increment(1),
        ...(usingFreeRename ? {} : { petCoins: increment(-RENAME_COST_COINS) }),
      });
    } catch (err: any) {
      showAlert('Could not rename', err.message);
    }
  };

  const selectOrUnlockFriend = async (friend: CoffeeFriend) => {
    if (!user || purchasingId || activeFriend.id === friend.id) return;
    const owned = unlockedFriends.has(friend.id);
    if (!owned && friend.specialUnlockOnly) return;
    if (!owned && coins < friend.cost) return;
    setPurchasingId(friend.id);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...(owned
          ? {}
          : { petCoins: increment(-friend.cost), unlockedCoffeeFriends: arrayUnion(friend.id) }),
        activeCoffeeFriend: friend.id,
      });
    } catch (err: any) {
      showAlert('Could not update coffee friend', err.message);
    } finally {
      setPurchasingId(null);
    }
  };

  const selectOrUnlockExpression = async (expr: CoffeeExpression) => {
    if (!user || purchasingId) return;
    const owned = unlockedExpressions.has(expr.id);
    if (!owned && coins < expr.cost) return;
    setPurchasingId(expr.id);
    try {
      const equipping = activeExpression?.id !== expr.id;
      await updateDoc(doc(db, 'users', user.uid), {
        ...(owned
          ? {}
          : { petCoins: increment(-expr.cost), unlockedExpressions: arrayUnion(expr.id) }),
        activeExpression: equipping ? expr.id : null,
      });
    } catch (err: any) {
      showAlert('Could not update expression', err.message);
    } finally {
      setPurchasingId(null);
    }
  };

  const selectBackground = async (bg: PetBackground) => {
    if (!user || purchasingId || activeBackground.id === bg.id) return;
    const owned = ownedBackgrounds.has(bg.id);
    if (!owned && coins < bg.cost) return;
    setPurchasingId(bg.id);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...(owned ? {} : { petCoins: increment(-bg.cost), petBackgroundsOwned: arrayUnion(bg.id) }),
        petBackground: bg.id,
      });
    } catch (err: any) {
      showAlert('Could not update cafe background', err.message);
    } finally {
      setPurchasingId(null);
    }
  };

  const startBuddyAdventure = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('Camera access needed', `Allow camera access to take ${buddyName} on an adventure.`);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    setAdventurePhotoUri(result.assets[0].uri);
    setAdventurePoseId(randomBuddyPose().id);
    setAdventureEditorVisible(true);
  };

  // The photo editor hands off here, then we ask for an optional location +
  // caption before actually posting — see finalizeBuddyAdventure below.
  const reviewBuddyAdventurePhoto = (result: BuddyPhotoResult) => {
    setAdventureEditorVisible(false);
    setPendingAdventureResult(result);
    setAdventureLocation('');
    setAdventureCaption('');
  };

  const cancelBuddyAdventure = () => {
    setPendingAdventureResult(null);
    setAdventurePhotoUri(null);
  };

  const finalizeBuddyAdventure = async () => {
    if (!pendingAdventureResult) return;
    const result = pendingAdventureResult;
    setPendingAdventureResult(null);
    setSavingAdventure(true);
    const photoUri = result.compositedUri ?? result.originalUri;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.granted) {
        await MediaLibrary.saveToLibraryAsync(photoUri);
      }
      if (user) {
        await postBuddyAdventure(user.uid, {
          displayName: user.displayName ?? 'Someone',
          buddyName,
          photoUri,
          poseId: result.poseId,
          source: 'adventure',
          ...(adventureLocation.trim() ? { location: adventureLocation.trim() } : {}),
          ...(adventureCaption.trim() ? { caption: adventureCaption.trim() } : {}),
        });
      }
      showAlert(
        'Saved! 🎉',
        `${buddyName}'s adventure photo is${permission.granted ? ' in your camera roll and' : ''} shared with your friends.`
      );
    } catch (err: any) {
      showAlert('Could not save photo', err.message);
    } finally {
      setSavingAdventure(false);
      setAdventurePhotoUri(null);
    }
  };

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Coffee Friends</Text>
        <View style={styles.coinBadge}>
          <Image source={COIN_ICON} style={styles.coinIcon} />
          <Text style={styles.coinBadgeText}>{coins.toFixed(1)}</Text>
        </View>
      </View>

      <View style={[styles.previewCard, { backgroundColor: activeBackground.color }]}>
        <Text style={styles.backgroundBadge}>{activeBackground.emoji}</Text>
        <View style={styles.previewImageWrap}>
          <Image
            source={getCoffeeFriendImage(activeFriend, activeExpression?.id)}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </View>
        {editingName ? (
          <TextInput
            style={styles.previewNameInput}
            value={nameDraft}
            onChangeText={setNameDraft}
            onSubmitEditing={saveRename}
            onBlur={saveRename}
            autoFocus
            maxLength={20}
          />
        ) : (
          <Pressable onPress={startRename}>
            <Text style={styles.previewName}>{buddyName} ✏️</Text>
            <Text style={styles.renameHint}>
              {freeRenamesLeft > 0
                ? `${freeRenamesLeft} free rename${freeRenamesLeft === 1 ? '' : 's'} left`
                : `Renaming costs ${RENAME_COST_COINS} coins`}
            </Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={[styles.adventureButton, styles.adventureButtonRow]}
        onPress={startBuddyAdventure}
        disabled={savingAdventure}
      >
        {!savingAdventure && (
          <Image source={UI_ICONS.camera} style={styles.adventureButtonIcon} resizeMode="contain" />
        )}
        <Text style={styles.adventureButtonText}>
          {savingAdventure ? 'Saving…' : `Take ${buddyName} for an adventure!`}
        </Text>
      </Pressable>

      <View style={styles.streakCard}>
        <View style={styles.streakValueRow}>
          <Image source={UI_ICONS.streak} style={styles.streakIcon} resizeMode="contain" />
          <Text style={styles.streakValue}>
            {weeklyStreak} week streak
            {weeklyStreak > 0 ? `  ·  ${streakMultiplier.toFixed(1)}x coins` : ''}
          </Text>
        </View>
        <View style={styles.visibilityRow}>
          <Pressable
            style={[
              styles.visibilityChip,
              styles.methodChip,
              streakVisibility === 'private' && styles.visibilityChipSelected,
            ]}
            onPress={() => setStreakVisibility('private')}
          >
            <Image source={UI_ICONS.byMyself} style={styles.methodChipIcon} resizeMode="contain" />
            <Text
              style={[
                styles.visibilityChipText,
                streakVisibility === 'private' && styles.visibilityChipTextSelected,
              ]}
            >
              Just me
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.visibilityChip,
              styles.methodChip,
              streakVisibility === 'friends' && styles.visibilityChipSelected,
            ]}
            onPress={() => setStreakVisibility('friends')}
          >
            <Image source={UI_ICONS.withFriends} style={styles.methodChipIcon} resizeMode="contain" />
            <Text
              style={[
                styles.visibilityChipText,
                streakVisibility === 'friends' && styles.visibilityChipTextSelected,
              ]}
            >
              Friends
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Earned accessories shelf hidden for now — coming back with real designs. */}

      <Text style={styles.sectionTitle}>☕ Collect coffee friends</Text>
      <View style={styles.filterRow}>
        {CATEGORY_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, categoryFilter === f.value && styles.filterChipSelected]}
            onPress={() => setCategoryFilter(f.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                categoryFilter === f.value && styles.filterChipTextSelected,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.itemGrid}>
        {visibleFriends.map((friend) => {
          const owned = unlockedFriends.has(friend.id);
          const affordable = owned || (!friend.specialUnlockOnly && coins >= friend.cost);
          const active = activeFriend.id === friend.id;
          return (
            <Pressable
              key={friend.id}
              style={[styles.friendCard, !affordable && styles.itemCardDisabled, active && styles.itemCardSelected]}
              onPress={() => selectOrUnlockFriend(friend)}
              disabled={!affordable || active || purchasingId === friend.id}
            >
              <Image
                source={friend.images.regular}
                style={[styles.friendImage, !owned && styles.friendImageLocked]}
                resizeMode="contain"
              />
              <Text style={styles.friendName} numberOfLines={1}>
                {friend.name}
              </Text>
              <Text style={styles.itemCost}>
                {active
                  ? 'Active'
                  : owned
                  ? 'Owned'
                  : purchasingId === friend.id
                  ? '…'
                  : friend.specialUnlockOnly
                  ? '🏆 Special reward'
                  : friend.cost === 0
                  ? 'Free'
                  : `${friend.cost} coins`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>🎭 Expressions</Text>
      <Text style={styles.coinHint}>
        Unlock an expression once and use it on any coffee friend you've unlocked.
      </Text>
      <View style={styles.itemGrid}>
        {COFFEE_EXPRESSIONS.map((expr) => {
          const owned = unlockedExpressions.has(expr.id);
          const affordable = owned || coins >= expr.cost;
          const equipped = activeExpression?.id === expr.id;
          return (
            <Pressable
              key={expr.id}
              style={[styles.itemCard, !affordable && styles.itemCardDisabled, equipped && styles.itemCardSelected]}
              onPress={() => selectOrUnlockExpression(expr)}
              disabled={!affordable || purchasingId === expr.id}
            >
              <Image
                source={getCoffeeFriendImage(activeFriend, expr.id)}
                style={styles.expressionPreviewImage}
                resizeMode="contain"
              />
              <Text style={styles.itemLabel}>
                {expr.emoji} {expr.name}
              </Text>
              <Text style={styles.itemCost}>
                {equipped
                  ? 'Equipped'
                  : owned
                  ? 'Tap to equip'
                  : purchasingId === expr.id
                  ? '…'
                  : `${expr.cost} coins`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>🏪 Decorate your cafe</Text>
      <View style={styles.itemGrid}>
        {PET_BACKGROUND_ITEMS.map((bg) => {
          const owned = ownedBackgrounds.has(bg.id);
          const affordable = owned || coins >= bg.cost;
          const selected = activeBackground.id === bg.id;
          return (
            <Pressable
              key={bg.id}
              style={[
                styles.itemCard,
                { backgroundColor: bg.color },
                !affordable && styles.itemCardDisabled,
                selected && styles.itemCardSelected,
              ]}
              onPress={() => selectBackground(bg)}
              disabled={!affordable || selected || purchasingId === bg.id}
            >
              <Text style={styles.itemEmoji}>{bg.emoji}</Text>
              <Text style={styles.itemLabel}>{bg.label}</Text>
              <Text style={styles.itemCost}>
                {selected
                  ? 'Selected'
                  : owned
                  ? 'Owned'
                  : purchasingId === bg.id
                  ? '…'
                  : bg.cost === 0
                  ? 'Free'
                  : `${bg.cost} coins`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
    {adventurePhotoUri && (
      <BuddyPhotoEditor
        visible={adventureEditorVisible}
        photoUri={adventurePhotoUri}
        friend={activeFriend}
        initialPoseId={adventurePoseId}
        onCancel={() => {
          setAdventureEditorVisible(false);
          setAdventurePhotoUri(null);
        }}
        onSave={reviewBuddyAdventurePhoto}
      />
    )}
    <Modal
      visible={!!pendingAdventureResult}
      animationType="slide"
      transparent
      onRequestClose={cancelBuddyAdventure}
    >
      <DismissKeyboardView>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.adventureDetailsBackdrop}>
            <View style={styles.adventureDetailsSheet}>
              <Text style={styles.adventureDetailsTitle}>Add details (optional)</Text>

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Blue Bottle Coffee"
                placeholderTextColor={COLORS.textFaint}
                value={adventureLocation}
                onChangeText={setAdventureLocation}
                maxLength={60}
              />

              <Text style={styles.label}>Caption</Text>
              <TextInput
                style={[styles.input, styles.captionInput]}
                placeholder="Say something about this adventure…"
                placeholderTextColor={COLORS.textFaint}
                value={adventureCaption}
                onChangeText={setAdventureCaption}
                multiline
                maxLength={120}
              />

              <View style={styles.adventureDetailsButtonRow}>
                <Pressable style={styles.adventureCancelButton} onPress={cancelBuddyAdventure}>
                  <Text style={styles.adventureCancelButtonText}>Discard</Text>
                </Pressable>
                <Pressable style={styles.adventureShareButton} onPress={finalizeBuddyAdventure}>
                  <Text style={styles.adventureShareButtonText}>Share</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </DismissKeyboardView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heading: { fontSize: 22, fontWeight: '700' },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  coinIcon: { width: 20, height: 20 },
  coinBadgeText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  previewCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 36,
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  backgroundBadge: { position: 'absolute', top: 16, right: 18, fontSize: 26 },
  previewImageWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: 220, height: 220 },
  expressionPreviewImage: { width: 56, height: 56 },
  previewName: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 10 },
  renameHint: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },
  previewNameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 2,
    minWidth: 140,
    textAlign: 'center',
  },
  coinHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  adventureButton: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  adventureButtonRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  adventureButtonIcon: { width: 18, height: 18 },
  adventureButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  streakCard: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  streakValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakIcon: { width: 18, height: 18 },
  streakValue: { fontSize: 13, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  visibilityRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  visibilityChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface,
  },
  visibilityChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  visibilityChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  visibilityChipTextSelected: { color: COLORS.white },
  methodChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  methodChipIcon: { width: 18, height: 18 },
  journeyCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 20,
  },
  journeyAccessoriesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  accessoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accessoryChip: {
    width: '30%',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  accessoryChipLocked: { opacity: 0.6 },
  accessoryEmoji: { fontSize: 22 },
  accessoryLabel: { fontSize: 11, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  accessoryDescription: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface,
  },
  filterChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  filterChipTextSelected: { color: COLORS.white },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  friendCard: {
    width: '30%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  friendImage: { width: 56, height: 56 },
  friendImageLocked: { opacity: 0.35 },
  friendName: { fontSize: 11, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  itemCard: {
    width: '30%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  itemCardDisabled: { opacity: 0.45 },
  itemCardSelected: { borderWidth: 2, borderColor: COLORS.primary },
  itemEmoji: { fontSize: 28 },
  itemLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  itemCost: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  adventureDetailsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  adventureDetailsSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 20,
    paddingBottom: 32,
  },
  adventureDetailsTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  captionInput: { minHeight: 60, textAlignVertical: 'top' },
  adventureDetailsButtonRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  adventureCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 13,
    alignItems: 'center',
  },
  adventureCancelButtonText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 15 },
  adventureShareButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 13,
    alignItems: 'center',
  },
  adventureShareButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
