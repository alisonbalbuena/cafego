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
      {[1, 2, 3, 4, 5].map((cup) =>
        onChange ? (
          <Pressable key={cup} onPress={() => onChange(cup)} hitSlop={4}>
            <Text style={{ fontSize: size, opacity: cup <= rounded ? 1 : 0.25 }}>☕</Text>
          </Pressable>
        ) : (
          <Text key={cup} style={{ fontSize: size, opacity: cup <= rounded ? 1 : 0.25 }}>
            ☕
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
