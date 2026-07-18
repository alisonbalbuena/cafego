import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

interface BarDatum {
  label: string;
  value: number;
}

interface Props {
  data: BarDatum[];
  formatValue?: (value: number) => string;
  barColor?: string;
  height?: number;
}

export default function BarChart({
  data,
  formatValue = (v) => `${v}`,
  barColor = COLORS.primary,
  height = 110,
}: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {data.map((d, i) => {
        const barHeight = d.value > 0 ? Math.max(4, (d.value / max) * height) : 2;
        return (
          <View key={i} style={styles.col}>
            <Text style={styles.value} numberOfLines={1}>
              {d.value > 0 ? formatValue(d.value) : ''}
            </Text>
            <View style={[styles.barTrack, { height }]}>
              <View style={[styles.bar, { height: barHeight, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.label}>{d.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-end', paddingHorizontal: 4, gap: 16 },
  col: { alignItems: 'center', width: 36 },
  value: { fontSize: 10, color: COLORS.textMuted, marginBottom: 4, height: 12 },
  barTrack: { width: 18, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 18, borderRadius: 6 },
  label: { fontSize: 10, color: COLORS.textFaint, marginTop: 6 },
});
