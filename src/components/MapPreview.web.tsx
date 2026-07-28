import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONTS } from '../theme';

interface Props {
  onPress: () => void;
}

export default function MapPreview({ onPress }: Props) {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <Ionicons name="map" size={26} color={COLORS.textFaint} />
      <Text style={styles.text}>Open on your phone to see the map</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 140,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  text: { fontSize: 12, color: COLORS.textFaint, fontFamily: FONTS.regular, letterSpacing: 0.3 },
});
