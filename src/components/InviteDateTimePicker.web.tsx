import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

interface Props {
  value: Date;
  onChange: (date: Date) => void;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// react-native-web doesn't have a native date picker, so this uses plain
// browser <input> elements (via TextInput, which react-native-web renders as
// an <input> under the hood) with type="date"/"time". Cast to `any` since
// `type` isn't in TextInput's RN types, only its web-rendered output.
const WebInput = TextInput as any;

export default function InviteDateTimePicker({ value, onChange }: Props) {
  const [dateStr, setDateStr] = useState(toDateInput(value));
  const [timeStr, setTimeStr] = useState(toTimeInput(value));

  const commit = (nextDate: string, nextTime: string) => {
    const [y, m, d] = nextDate.split('-').map(Number);
    const [h, min] = nextTime.split(':').map(Number);
    if (!y || !m || !d || Number.isNaN(h) || Number.isNaN(min)) return;
    onChange(new Date(y, m - 1, d, h, min));
  };

  return (
    <View style={styles.row}>
      <WebInput
        style={styles.input}
        type="date"
        value={dateStr}
        onChangeText={(v: string) => {
          setDateStr(v);
          commit(v, timeStr);
        }}
      />
      <WebInput
        style={styles.input}
        type="time"
        value={timeStr}
        onChangeText={(v: string) => {
          setTimeStr(v);
          commit(dateStr, v);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
  },
});
