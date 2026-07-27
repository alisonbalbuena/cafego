import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

export default function BackButton({ navigation }: { navigation: any }) {
  return (
    <Pressable style={styles.button} onPress={() => navigation.goBack()} hitSlop={10}>
      <Ionicons name="arrow-back" size={22} color={COLORS.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
});
