import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { StudySession } from '../types';
import { COLORS, RADIUS, FONTS } from '../theme';

const MAX_RESULTS = 15;

export default function CommunityFeedSection() {
  const { user, profile } = useAuth();
  const [everyoneSessions, setEveryoneSessions] = useState<StudySession[]>([]);
  const [communitySessions, setCommunitySessions] = useState<StudySession[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'studySessions'),
      where('visibility', '==', 'everyone'),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEveryoneSessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!profile?.community) {
      setCommunitySessions([]);
      return;
    }
    const q = query(
      collection(db, 'studySessions'),
      where('visibility', '==', 'community'),
      where('community', '==', profile.community),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCommunitySessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsubscribe;
  }, [profile?.community]);

  const combined = useMemo(() => {
    const map = new Map<string, StudySession>();
    [...communitySessions, ...everyoneSessions].forEach((s) => {
      if (s.uid !== user?.uid) map.set(s.id, s);
    });
    return Array.from(map.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_RESULTS);
  }, [communitySessions, everyoneSessions, user]);

  if (combined.length === 0) return null;

  return (
    <View>
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="school" size={16} color={COLORS.textMuted} />
        <Text style={styles.sectionTitle}>Community & public</Text>
      </View>
      <View style={styles.card}>
        {combined.map((s, i) => (
          <View key={s.id} style={[styles.row, i === combined.length - 1 && styles.rowLast]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{s.displayName}</Text>
              <Text style={styles.meta}>
                📍 {s.cafeName} · {s.subject}
              </Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {s.visibility === 'everyone' ? '🌍 Public' : `🏫 ${s.community}`}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 8,
  },
  rowLast: { borderBottomWidth: 0 },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  tag: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  tagText: { fontSize: 11, fontWeight: '600', color: COLORS.primary, fontFamily: FONTS.semiBold, letterSpacing: 0.2 },
});
