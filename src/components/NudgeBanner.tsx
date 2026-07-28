import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { Nudge } from '../types';
import { COLORS, RADIUS, FONTS } from '../theme';

export default function NudgeBanner() {
  const { user } = useAuth();
  const [nudges, setNudges] = useState<Nudge[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'nudges'), where('toUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as Nudge);
      docs.sort((a, b) => b.createdAt - a.createdAt);
      setNudges(docs);
    });
    return unsubscribe;
  }, [user]);

  const dismiss = (id: string) => {
    deleteDoc(doc(db, 'nudges', id)).catch(() => {});
  };

  if (nudges.length === 0) return null;

  return (
    <View style={styles.container}>
      {nudges.map((n) => (
        <View key={n.id} style={styles.card}>
          <Text style={styles.text}>
            👋 <Text style={styles.name}>{n.fromDisplayName}</Text> nudged you to come study!
          </Text>
          <Pressable onPress={() => dismiss(n.id)} hitSlop={10}>
            <Text style={styles.dismiss}>✕</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  text: { fontSize: 13, color: COLORS.primary, flex: 1, marginRight: 8, fontFamily: FONTS.regular, letterSpacing: 0.4 },
  name: { fontWeight: '700', fontFamily: FONTS.semiBold },
  dismiss: { fontSize: 14, color: COLORS.primary, fontWeight: '700', fontFamily: FONTS.semiBold },
});
