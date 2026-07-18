import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Linking,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
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

const REVIEW_CATEGORIES: { key: keyof CafeReview; label: string }[] = [
  { key: 'ambienceRating', label: 'Ambience' },
  { key: 'drinksRating', label: 'Drinks' },
  { key: 'pricesRating', label: 'Prices' },
  { key: 'environmentRating', label: 'Environment' },
];

export default function CafeProfileScreen({ route }: any) {
  const { cafeId, cafeName } = route.params;
  const { user } = useAuth();
  const [program, setProgram] = useState<CafeProgram | null>(null);
  const [account, setAccount] = useState<RewardAccount | null>(null);
  const [announcements, setAnnouncements] = useState<CafeAnnouncement[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<CafeReview[]>([]);
  const [ambience, setAmbience] = useState(0);
  const [drinks, setDrinks] = useState(0);
  const [prices, setPrices] = useState(0);
  const [environment, setEnvironment] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        }
      }
    });
    return unsubscribe;
  }, [cafeId, user]);

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

  const isPunchcard = program?.type === 'punchcard';
  const current = isPunchcard ? account?.punches ?? 0 : account?.points ?? 0;
  const goal = isPunchcard ? program?.punchesRequired ?? 0 : program?.pointsForReward ?? 0;

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

        {program && (
          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>{program.rewardDescription}</Text>
            <Text style={styles.progressValue}>
              {goal > 0 && current >= goal
                ? '🎉 Reward ready — redeem at checkout'
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
              <Image key={url} source={{ uri: url }} style={styles.photo} />
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
            <Text style={styles.formLabel}>Environment</Text>
            <StarRating value={environment} onChange={setEnvironment} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Optional written review…"
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <Pressable style={styles.button} onPress={submitReview} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Saving…' : 'Submit review'}</Text>
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
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  progressCard: { backgroundColor: '#f6f6f6', borderRadius: 12, padding: 16, marginBottom: 20 },
  progressLabel: { fontSize: 14, fontWeight: '600' },
  progressValue: { fontSize: 13, color: '#2a7a2a', marginTop: 4, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  emptyText: { color: '#999', marginBottom: 12 },
  announcementRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  announcementMessage: { fontSize: 14 },
  announcementDate: { fontSize: 11, color: '#999', marginTop: 4 },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuName: { fontSize: 14, fontWeight: '600' },
  menuDescription: { fontSize: 12, color: '#666', marginTop: 2 },
  menuPrice: { fontSize: 14, fontWeight: '600' },
  link: { color: '#1a5fb4', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  photoRow: { marginBottom: 12 },
  photo: { width: 120, height: 120, borderRadius: 10, marginRight: 8, backgroundColor: '#f0f0f0' },
  averagesCard: { backgroundColor: '#f6f6f6', borderRadius: 12, padding: 16, marginBottom: 12 },
  averageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  averageLabel: { fontSize: 13, width: 90 },
  averageValue: { fontSize: 13, color: '#666' },
  reviewCount: { fontSize: 12, color: '#999', marginTop: 6 },
  reviewForm: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 16, marginTop: 4 },
  formTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  formLabel: { fontSize: 13, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  commentRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  commentAuthor: { fontSize: 13, fontWeight: '600' },
  commentText: { fontSize: 13, color: '#444', marginTop: 2 },
});
