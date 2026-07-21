import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  Modal,
  ScrollView,
  Linking,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import StarRating from '../components/StarRating';
import {
  CafeAnnouncement,
  CafeProgram,
  CafeReview,
  MenuItem,
  RewardAccount,
} from '../types';
import { showAlert } from '../utils/alert';
import { COLORS } from '../theme';
import { SHOW_LOYALTY_PROGRAM } from '../constants';

const REVIEW_CATEGORIES: { key: keyof CafeReview; label: string }[] = [
  { key: 'ambienceRating', label: 'Ambience' },
  { key: 'drinksRating', label: 'Drinks' },
  { key: 'pricesRating', label: 'Prices' },
  { key: 'environmentRating', label: 'Studyability' },
];

interface Friend {
  uid: string;
  displayName: string;
}

export default function CafeProfileScreen({ route }: any) {
  const { cafeId, cafeName } = route.params;
  const { user } = useAuth();
  const [program, setProgram] = useState<CafeProgram | null>(null);
  const [account, setAccount] = useState<RewardAccount | null>(null);
  const [announcements, setAnnouncements] = useState<CafeAnnouncement[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<CafeReview[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [ambience, setAmbience] = useState(0);
  const [drinks, setDrinks] = useState(0);
  const [prices, setPrices] = useState(0);
  const [environment, setEnvironment] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'cafePrograms', cafeId), (snap) => {
      setProgram(snap.exists() ? (snap.data() as CafeProgram) : null);
    });
    return unsubscribe;
  }, [cafeId]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'rewardAccounts', `${cafeId}_${user.uid}`), (snap) => {
      setAccount(snap.exists() ? (snap.data() as RewardAccount) : null);
    });
    return unsubscribe;
  }, [cafeId, user]);

  useEffect(() => {
    const q = query(collection(db, 'cafeAnnouncements'), where('cafeId', '==', cafeId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      docs.sort((a, b) => b.createdAt - a.createdAt);
      setAnnouncements(docs);
    });
    return unsubscribe;
  }, [cafeId]);

  useEffect(() => {
    const q = query(collection(db, 'menuItems'), where('cafeId', '==', cafeId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMenu(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsubscribe;
  }, [cafeId]);

  useEffect(() => {
    const q = query(collection(db, 'cafeReviews'), where('cafeId', '==', cafeId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CafeReview[];
      docs.sort((a, b) => b.createdAt - a.createdAt);
      setReviews(docs);
      if (user) {
        const mine = docs.find((r) => r.uid === user.uid);
        if (mine) {
          setAmbience(mine.ambienceRating);
          setDrinks(mine.drinksRating);
          setPrices(mine.pricesRating);
          setEnvironment(mine.environmentRating);
          setComment(mine.comment ?? '');
          setReviewPhotos(mine.photoUrls ?? []);
        }
      }
    });
    return unsubscribe;
  }, [cafeId, user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snapshot) => setFriends(snapshot.docs.map((d) => d.data() as Friend))
    );
    return unsubscribe;
  }, [user]);

  const friendReviews = useMemo(() => {
    const friendUids = new Set(friends.map((f) => f.uid));
    return reviews.filter((r) => friendUids.has(r.uid));
  }, [reviews, friends]);

  const averages = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = (key: keyof CafeReview) =>
      reviews.reduce((total, r) => total + (r[key] as number), 0) / reviews.length;
    return {
      ambienceRating: sum('ambienceRating'),
      drinksRating: sum('drinksRating'),
      pricesRating: sum('pricesRating'),
      environmentRating: sum('environmentRating'),
    };
  }, [reviews]);

  const hasExistingReview = useMemo(
    () => reviews.some((r) => r.uid === user?.uid),
    [reviews, user]
  );

  const isPunchcard = program?.type === 'punchcard';
  const current = isPunchcard ? account?.punches ?? 0 : account?.points ?? 0;
  const goal = isPunchcard ? program?.punchesRequired ?? 0 : program?.pointsForReward ?? 0;

  const pickReviewPhoto = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission needed', 'Allow photo library access to add photos to your review.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingPhoto(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const fileRef = ref(storage, `reviewPhotos/${user.uid}/${cafeId}_${Date.now()}.jpg`);
      await uploadBytes(fileRef, blob);
      const url = await getDownloadURL(fileRef);
      setReviewPhotos((prev) => [...prev, url]);
    } catch (err: any) {
      showAlert('Upload failed', err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removeReviewPhoto = (url: string) => {
    setReviewPhotos((prev) => prev.filter((u) => u !== url));
  };

  const submitReview = async () => {
    if (!user) return;
    if (!ambience || !drinks || !prices || !environment) {
      showAlert('Missing ratings', 'Rate all four categories before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'cafeReviews', `${cafeId}_${user.uid}`), {
        cafeId,
        uid: user.uid,
        displayName: user.displayName ?? 'Someone',
        ambienceRating: ambience,
        drinksRating: drinks,
        pricesRating: prices,
        environmentRating: environment,
        comment: comment.trim(),
        photoUrls: reviewPhotos,
        createdAt: Date.now(),
      });
      showAlert('Thanks!', 'Your review was saved.');
    } catch (err: any) {
      showAlert('Could not save review', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView>
        <Text style={styles.heading}>{cafeName}</Text>

        {SHOW_LOYALTY_PROGRAM && program && program.status !== 'pending' && (
          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>{program.rewardDescription}</Text>
            <Text style={styles.progressValue}>
              {goal > 0 && current >= goal
                ? account?.rewardExpiresAt
                  ? `🎉 Reward ready — redeem by ${new Date(
                      account.rewardExpiresAt
                    ).toLocaleDateString()}`
                  : '🎉 Reward ready — redeem at checkout'
                : isPunchcard
                ? `${current} / ${goal} punches`
                : `${current} / ${goal} points`}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Announcements</Text>
        {announcements.length === 0 ? (
          <Text style={styles.emptyText}>No announcements yet.</Text>
        ) : (
          announcements.map((a) => (
            <View key={a.id} style={styles.announcementRow}>
              <Text style={styles.announcementMessage}>{a.message}</Text>
              <Text style={styles.announcementDate}>
                {new Date(a.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Menu</Text>

        {!!program?.onlineMenuUrl && (
          <Pressable onPress={() => Linking.openURL(program.onlineMenuUrl!)}>
            <Text style={styles.link}>🔗 View online menu</Text>
          </Pressable>
        )}

        {!!program?.menuImageUrls?.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {program.menuImageUrls.map((url) => (
              <Pressable key={url} onPress={() => setViewerUrl(url)}>
                <Image source={{ uri: url }} style={styles.photo} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {menu.length === 0 && !program?.onlineMenuUrl && !program?.menuImageUrls?.length ? (
          <Text style={styles.emptyText}>No menu posted yet.</Text>
        ) : (
          menu.map((item) => (
            <View key={item.id} style={styles.menuRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuName}>{item.name}</Text>
                {!!item.description && (
                  <Text style={styles.menuDescription}>{item.description}</Text>
                )}
              </View>
              <Text style={styles.menuPrice}>${item.price.toFixed(2)}</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Friends' reviews</Text>
        {friendReviews.length === 0 ? (
          <Text style={styles.emptyText}>None of your friends have reviewed this cafe yet.</Text>
        ) : (
          friendReviews.map((r) => {
            const friendAverage =
              (r.ambienceRating + r.drinksRating + r.pricesRating + r.environmentRating) / 4;
            return (
              <View key={r.id} style={styles.friendReviewRow}>
                <View style={styles.friendReviewHeader}>
                  <Text style={styles.commentAuthor}>{r.displayName}</Text>
                  <StarRating value={friendAverage} size={14} />
                </View>
                {!!r.comment && <Text style={styles.commentText}>{r.comment}</Text>}
                {!!r.photoUrls?.length && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewPhotoRow}>
                    {r.photoUrls.map((url) => (
                      <Pressable key={url} onPress={() => setViewerUrl(url)}>
                        <Image source={{ uri: url }} style={styles.reviewPhotoThumb} />
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            );
          })
        )}

        <Text style={styles.sectionTitle}>Reviews</Text>
        {averages ? (
          <View style={styles.averagesCard}>
            {REVIEW_CATEGORIES.map(({ key, label }) => (
              <View key={key} style={styles.averageRow}>
                <Text style={styles.averageLabel}>{label}</Text>
                <StarRating value={averages[key as keyof typeof averages]} size={16} />
                <Text style={styles.averageValue}>
                  {averages[key as keyof typeof averages].toFixed(1)}
                </Text>
              </View>
            ))}
            <Text style={styles.reviewCount}>
              {reviews.length} review{reviews.length === 1 ? '' : 's'}
            </Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>No reviews yet — be the first!</Text>
        )}

        <View style={styles.reviewForm}>
          <Text style={styles.formTitle}>Rate this cafe</Text>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Ambience</Text>
            <StarRating value={ambience} onChange={setAmbience} />
          </View>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Drinks</Text>
            <StarRating value={drinks} onChange={setDrinks} />
          </View>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Prices</Text>
            <StarRating value={prices} onChange={setPrices} />
          </View>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Studyability</Text>
            <StarRating value={environment} onChange={setEnvironment} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Optional written review…"
            value={comment}
            onChangeText={setComment}
            multiline
          />

          <Text style={styles.photoLabel}>Photos of your drinks/food (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewPhotoRow}>
            {reviewPhotos.map((url) => (
              <View key={url} style={styles.reviewPhotoWrap}>
                <Pressable onPress={() => setViewerUrl(url)}>
                  <Image source={{ uri: url }} style={styles.reviewPhoto} />
                </Pressable>
                <Pressable style={styles.removePhotoButton} onPress={() => removeReviewPhoto(url)}>
                  <Text style={styles.removePhotoText}>✕</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={styles.addPhotoButton}
              onPress={pickReviewPhoto}
              disabled={uploadingPhoto}
            >
              <Text style={styles.addPhotoButtonText}>{uploadingPhoto ? '…' : '+ Add'}</Text>
            </Pressable>
          </ScrollView>

          <Pressable style={styles.button} onPress={submitReview} disabled={submitting}>
            <Text style={styles.buttonText}>
              {submitting ? 'Saving…' : hasExistingReview ? 'Update review' : 'Submit review'}
            </Text>
          </Pressable>
        </View>

        {reviews.filter((r) => r.comment).length > 0 && (
          <View style={{ marginTop: 8 }}>
            {reviews
              .filter((r) => r.comment)
              .map((r) => (
                <View key={r.id} style={styles.commentRow}>
                  <Text style={styles.commentAuthor}>{r.displayName}</Text>
                  <Text style={styles.commentText}>{r.comment}</Text>
                  {!!r.photoUrls?.length && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.reviewPhotoRow}
                    >
                      {r.photoUrls.map((url) => (
                        <Pressable key={url} onPress={() => setViewerUrl(url)}>
                          <Image source={{ uri: url }} style={styles.reviewPhotoThumb} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!viewerUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUrl(null)}
      >
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUrl(null)}>
          {!!viewerUrl && (
            <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  progressCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 20 },
  progressLabel: { fontSize: 14, fontWeight: '600' },
  progressValue: { fontSize: 13, color: COLORS.success, marginTop: 4, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  emptyText: { color: COLORS.textFaint, marginBottom: 12 },
  announcementRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  announcementMessage: { fontSize: 14 },
  announcementDate: { fontSize: 11, color: COLORS.textFaint, marginTop: 4 },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  menuName: { fontSize: 14, fontWeight: '600' },
  menuDescription: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  menuPrice: { fontSize: 14, fontWeight: '600' },
  link: { color: COLORS.link, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  photoRow: { marginBottom: 12 },
  photo: { width: 140, height: 140, borderRadius: 10, marginRight: 8, backgroundColor: COLORS.card },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: { width: '100%', height: '80%' },
  averagesCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  averageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  averageLabel: { fontSize: 13, width: 90 },
  averageValue: { fontSize: 13, color: COLORS.textMuted },
  reviewCount: { fontSize: 12, color: COLORS.textFaint, marginTop: 6 },
  reviewForm: { borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: 12, padding: 16, marginTop: 4 },
  formTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  formLabel: { fontSize: 13, color: COLORS.text },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  photoLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginTop: 12, marginBottom: 8 },
  reviewPhotoRow: { marginBottom: 4 },
  reviewPhotoWrap: { marginRight: 8, position: 'relative' },
  reviewPhoto: { width: 72, height: 72, borderRadius: 10, backgroundColor: COLORS.card },
  reviewPhotoThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    marginRight: 8,
    marginTop: 6,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: { color: '#fff', fontSize: 12, lineHeight: 12 },
  addPhotoButton: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButtonText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  commentRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  commentAuthor: { fontSize: 13, fontWeight: '600' },
  commentText: { fontSize: 13, color: COLORS.text, marginTop: 2 },
  friendReviewRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  friendReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
