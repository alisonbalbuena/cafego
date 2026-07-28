import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        🗺️ Map view is only available in the mobile app — open this in Expo Go on your phone to
        see nearby cafes and friends on a map.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, fontFamily: FONTS.regular, letterSpacing: 0.4 },
});
