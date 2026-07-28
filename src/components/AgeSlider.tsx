import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { COLORS, FONTS } from '../theme';
import { MIN_AGE_TO_USE_APP } from '../constants';

const SLIDER_MIN = 8;
const SLIDER_MAX = 100;

interface Props {
  age: number;
  onChange: (age: number) => void;
  /** Set for dark backgrounds (e.g. the Welcome screen). */
  dark?: boolean;
}

export default function AgeSlider({ age, onChange, dark }: Props) {
  const tooYoung = age < MIN_AGE_TO_USE_APP;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, dark && styles.labelDark]}>How old are you?</Text>
      <Text style={[styles.ageValue, dark && styles.ageValueDark]}>{age}</Text>
      <Slider
        style={styles.slider}
        minimumValue={SLIDER_MIN}
        maximumValue={SLIDER_MAX}
        step={1}
        value={age}
        onValueChange={onChange}
        minimumTrackTintColor={COLORS.accent}
        maximumTrackTintColor={dark ? 'rgba(255,255,255,0.25)' : COLORS.border}
        thumbTintColor={COLORS.accent}
      />
      {tooYoung && (
        <Text style={styles.warning}>
          You must be {MIN_AGE_TO_USE_APP} or older to use Study Cafe.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  label: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    letterSpacing: 0.4,
  },
  labelDark: { color: '#fffcf6' },
  ageValue: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: COLORS.accent,
    marginTop: 2,
    letterSpacing: 0.6,
  },
  ageValueDark: { color: COLORS.accent },
  slider: { width: '100%', height: 40, marginTop: 4 },
  warning: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.danger,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
