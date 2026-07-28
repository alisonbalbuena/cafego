import React, { useState } from 'react';
import { Text, Pressable, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, FONTS } from '../theme';

interface Props {
  value: Date;
  onChange: (date: Date) => void;
}

export default function InviteDateTimePicker({ value, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateText}>
          {value.toLocaleString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={value}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={(event, selected) => {
            setShowPicker(Platform.OS === 'ios');
            if (selected) onChange(selected);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
  },
  dateText: { fontSize: 15, color: COLORS.text, fontFamily: FONTS.regular, letterSpacing: 0.4 },
});
