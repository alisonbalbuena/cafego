import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { arrayUnion, doc, increment, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import {
  getNextPetStage,
  getPetBackground,
  getPetStage,
  growthFromCost,
  PET_BACKGROUND_ITEMS,
  PET_CLOTHING_ITEMS,
  PET_FOOD_ITEMS,
  PetBackground,
  PetItem,
} from '../data/petItems';
import { showAlert } from '../utils/alert';
import { useRefresh } from '../hooks/useRefresh';
import { getCombinedMultiplier } from '../utils/streakCoins';
import { COLORS, RADIUS } from '../theme';

export default function PetScreen() {
  const { user, profile } = useAuth();
  const { refreshing, onRefresh } = useRefresh();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const coins = profile?.petCoins ?? 0;
  const growth = profile?.petGrowth ?? 0;
  const weeklyStreak = profile?.weeklyStreak ?? 0;
  const streakMultiplier = getCombinedMultiplier(weeklyStreak);
  const streakVisibility = profile?.streakVisibility ?? 'private';
  const outfit = useMemo(() => new Set(profile?.petOutfit ?? []), [profile?.petOutfit]);
  const petName = profile?.petName ?? 'Buddy';
  const ownedBackgrounds = useMemo(
    () => new Set(['default', ...(profile?.petBackgroundsOwned ?? [])]),
    [profile?.petBackgroundsOwned]
  );
  const activeBackground = getPetBackground(profile?.petBackground);

  const stage = getPetStage(growth);
  const nextStage = getNextPetStage(growth);
  const progressToNext = nextStage
    ? Math.min(1, (growth - stage.minGrowth) / (nextStage.minGrowth - stage.minGrowth))
    : 1;

  const wornEmojis = PET_CLOTHING_ITEMS.filter((item) => outfit.has(item.id)).map((i) => i.emoji);

  const startRename = () => {
    setNameDraft(petName);
    setEditingName(true);
  };

  const saveRename = async () => {
    if (!user) return;
    const clean = nameDraft.trim().slice(0, 20);
    setEditingName(false);
    if (!clean || clean === petName) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { petName: clean });
    } catch (err: any) {
      showAlert('Could not rename buddy', err.message);
    }
  };

  const setStreakVisibility = async (visibility: 'private' | 'friends') => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { streakVisibility: visibility });
    } catch (err: any) {
      showAlert('Could not update streak visibility', err.message);
    }
  };

  const feed = async (item: PetItem) => {
    if (!user || coins < item.cost || purchasingId) return;
    setPurchasingId(item.id);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        petCoins: increment(-item.cost),
        petGrowth: increment(growthFromCost(item.cost)),
      });
    } catch (err: any) {
      showAlert('Could not feed buddy', err.message);
    } finally {
      setPurchasingId(null);
    }
  };

  const clothe = async (item: PetItem) => {
    if (!user || coins < item.cost || outfit.has(item.id) || purchasingId) return;
    setPurchasingId(item.id);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        petCoins: increment(-item.cost),
        petGrowth: increment(growthFromCost(item.cost)),
        petOutfit: arrayUnion(item.id),
      });
    } catch (err: any) {
      showAlert('Could not dress buddy', err.message);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      <Text style={styles.heading}>Study Buddy</Text>

      <View style={[styles.petCard, { backgroundColor: activeBackground.color }]}>
        <Text style={styles.backgroundBadge}>{activeBackground.emoji}</Text>
        {editingName ? (
          <TextInput
            style={styles.nameInput}
            value={nameDraft}
            onChangeText={setNameDraft}
            onSubmitEditing={saveRename}
            onBlur={saveRename}
            autoFocus
            maxLength={20}
          />
        ) : (
          <Pressable onPress={startRename}>
            <Text style={styles.petName}>{petName} ✏️</Text>
          </Pressable>
        )}

        <Text style={styles.petEmoji}>{stage.emoji}</Text>
        {wornEmojis.length > 0 && <Text style={styles.wornRow}>{wornEmojis.join(' ')}</Text>}
        <Text style={styles.stageLabel}>{stage.label}</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressToNext * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {nextStage
            ? `${growth}/${nextStage.minGrowth} to become a ${nextStage.label}`
            : 'Fully grown — as nerdy as it gets! 🎉'}
        </Text>
      </View>

      <View style={styles.coinCard}>
        <Text style={styles.coinValue}>💰 {coins.toFixed(1)} coins</Text>
        <Text style={styles.coinHint}>Earn 1 coin per hour you study.</Text>
      </View>

      <View style={styles.streakCard}>
        <Text style={styles.streakValue}>🔥 {weeklyStreak} week streak</Text>
        {weeklyStreak > 0 && (
          <Text style={styles.streakMultiplierText}>{streakMultiplier.toFixed(1)}x coins</Text>
        )}
        <Text style={styles.coinHint}>Each week you study adds +0.2x to your coin earnings.</Text>
        <View style={styles.visibilityRow}>
          <Pressable
            style={[styles.visibilityChip, streakVisibility === 'private' && styles.visibilityChipSelected]}
            onPress={() => setStreakVisibility('private')}
          >
            <Text
              style={[
                styles.visibilityChipText,
                streakVisibility === 'private' && styles.visibilityChipTextSelected,
              ]}
            >
              🔒 Just me
            </Text>
          </Pressable>
          <Pressable
            style={[styles.visibilityChip, streakVisibility === 'friends' && styles.visibilityChipSelected]}
            onPress={() => setStreakVisibility('friends')}
          >
            <Text
              style={[
                styles.visibilityChipText,
                streakVisibility === 'friends' && styles.visibilityChipTextSelected,
              ]}
            >
              👥 Friends
            </Text>
          </Pressable>
        </View>
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

      <Text style={styles.sectionTitle}>🍽️ Feed</Text>
      <View style={styles.itemGrid}>
        {PET_FOOD_ITEMS.map((item) => {
          const affordable = coins >= item.cost;
          return (
            <Pressable
              key={item.id}
              style={[styles.itemCard, !affordable && styles.itemCardDisabled]}
              onPress={() => feed(item)}
              disabled={!affordable || purchasingId === item.id}
            >
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Text style={styles.itemCost}>
                {purchasingId === item.id ? '…' : `${item.cost} coins`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>👕 Clothe</Text>
      <View style={styles.itemGrid}>
        {PET_CLOTHING_ITEMS.map((item) => {
          const owned = outfit.has(item.id);
          const affordable = coins >= item.cost;
          return (
            <Pressable
              key={item.id}
              style={[styles.itemCard, (owned || !affordable) && styles.itemCardDisabled]}
              onPress={() => clothe(item)}
              disabled={owned || !affordable || purchasingId === item.id}
            >
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Text style={styles.itemCost}>
                {owned ? 'Owned' : purchasingId === item.id ? '…' : `${item.cost} coins`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  petCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  backgroundBadge: { position: 'absolute', top: 12, right: 14, fontSize: 20 },
  petName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  nameInput: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
    paddingVertical: 2,
    minWidth: 120,
    textAlign: 'center',
  },
  petEmoji: { fontSize: 88 },
  wornRow: { fontSize: 22, marginTop: 4 },
  stageLabel: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginTop: 8 },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.card,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 4 },
  progressText: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
  coinCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  coinValue: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  coinHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  streakCard: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  streakValue: { fontSize: 16, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  streakMultiplierText: { fontSize: 13, fontWeight: '700', color: COLORS.accent, marginTop: 4 },
  visibilityRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
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
});
