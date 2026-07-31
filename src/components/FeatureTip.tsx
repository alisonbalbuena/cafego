import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { COLORS, RADIUS, FONTS } from '../theme';

const STORAGE_PREFIX = 'featureTip:seen:';

interface Props {
  /** Stable id for this tip — stored in the user's `seenTips` once dismissed
   * so it never shows again on any device. */
  id: string;
  title: string;
  body: string;
  /** Bolder styling (thicker primary-colored border + a "Worth knowing"
   * badge) for tips introducing a feature that's easy to scroll past. */
  highlight?: boolean;
  /** Optional secondary button (e.g. "Take me there") shown next to "Got
   * it" — does not itself dismiss the tip, so pair it with navigation that
   * lands somewhere the user can dismiss it from. */
  actionLabel?: string;
  onAction?: () => void;
}

/** A dismissible one-time callout that introduces a feature the first time a
 * user reaches the screen it lives on, instead of a single upfront tutorial
 * wizard nobody reads. Persisted to the user's profile via `seenTips` so it
 * follows them across devices. */
export default function FeatureTip({ id, title, body, highlight, actionLabel, onAction }: Props) {
  const { user, profile } = useAuth();
  const [dismissedLocally, setDismissedLocally] = useState(false);
  // The Firestore write below is best-effort and silently swallows errors —
  // on a flaky connection it can fail without the user ever knowing, which
  // used to mean a "dismissed" tip would just come back on the next visit.
  // AsyncStorage is this device's own guaranteed record of "seen it,"
  // independent of network/sync — checked before rendering anything so a
  // previously-dismissed tip can't even flash on screen while that check
  // is in flight.
  const [checkedDevice, setCheckedDevice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_PREFIX + id).then((value) => {
      if (cancelled) return;
      if (value) setDismissedLocally(true);
      setCheckedDevice(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!checkedDevice || dismissedLocally || profile?.seenTips?.includes(id)) return null;

  const dismiss = () => {
    setDismissedLocally(true);
    AsyncStorage.setItem(STORAGE_PREFIX + id, '1').catch(() => {});
    if (user) {
      updateDoc(doc(db, 'users', user.uid), { seenTips: arrayUnion(id) }).catch(() => {});
    }
  };

  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      {highlight && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>WORTH KNOWING</Text>
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.buttonRow}>
        <Pressable style={styles.gotIt} onPress={dismiss}>
          <Text style={styles.gotItText}>Got it</Text>
        </Pressable>
        {!!actionLabel && !!onAction && (
          <Pressable style={styles.actionButton} onPress={onAction}>
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 14,
  },
  cardHighlight: {
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONTS.regular,
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  gotIt: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  gotItText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.3,
  },
  actionButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.3,
  },
});
