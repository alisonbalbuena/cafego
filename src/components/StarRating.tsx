import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}

export default function StarRating({ value, onChange, size = 20 }: StarRatingProps) {
  const rounded = Math.round(value);
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) =>
        onChange ? (
          <Pressable key={star} onPress={() => onChange(star)} hitSlop={4}>
            <Text style={{ fontSize: size, color: star <= rounded ? '#c0862a' : '#ddd' }}>★</Text>
          </Pressable>
        ) : (
          <Text key={star} style={{ fontSize: size, color: star <= rounded ? '#c0862a' : '#ddd' }}>
            ★
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
