import React from 'react';
import { View, TextInput, Pressable, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../theme';

interface Props extends Pick<TextInputProps, 'autoFocus' | 'autoCapitalize' | 'keyboardType'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  style?: any;
}

export default function SearchBar({ value, onChangeText, placeholder, style, ...inputProps }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="search" size={18} color={COLORS.textMuted} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textFaint}
        value={value}
        onChangeText={onChangeText}
        {...inputProps}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={COLORS.textFaint} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
});
