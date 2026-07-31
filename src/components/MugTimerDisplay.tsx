import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { FONTS } from '../theme';

interface Props {
  /** Pre-formatted time string, e.g. "12:34" or "1:02:03". */
  label: string;
  paused?: boolean;
}

const MUG_FRAME = require('../../assets/icons/mug_timer_frame.png');
const STEAM_WISP = require('../../assets/icons/steam_wisp.png');

// Native size of mug_timer_frame.png — used to keep the "screen" overlay
// aligned to the art regardless of the display size below.
const FRAME_W = 320;
const FRAME_H = 300;
const DISPLAY_W = 220;
const DISPLAY_H = Math.round((FRAME_H / FRAME_W) * DISPLAY_W);

function Steam({ delay, leftPct, paused }: { delay: number; leftPct: number; paused: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (paused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay, paused]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -26] });
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.9, 0.4, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] });

  return (
    <Animated.Image
      source={STEAM_WISP}
      style={[
        styles.steam,
        { left: `${leftPct}%`, opacity, transform: [{ translateY }, { scale }] },
      ]}
      resizeMode="contain"
    />
  );
}

/** The pixel-art mug-shaped clock face — animated steam, Monocraft digits in
 * the "screen" area. Shared by every timer surface (elapsed-time display,
 * and every study method's phase countdown) so they all look the same. */
export default function MugTimerDisplay({ label, paused = false }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.steamLayer}>
        <Steam delay={0} leftPct={12} paused={paused} />
        <Steam delay={350} leftPct={30} paused={paused} />
        <Steam delay={700} leftPct={48} paused={paused} />
        <Steam delay={1050} leftPct={66} paused={paused} />
        <Steam delay={1400} leftPct={82} paused={paused} />
      </View>
      <View style={styles.mugWrap}>
        <Image source={MUG_FRAME} style={styles.mugFrame} resizeMode="contain" />
        <View style={styles.screenOverlay}>
          <Text style={styles.timeText}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  steamLayer: { width: DISPLAY_W, height: 40 },
  steam: { position: 'absolute', bottom: 0, width: 16, height: 28 },
  mugWrap: { width: DISPLAY_W, height: DISPLAY_H },
  mugFrame: { width: '100%', height: '100%' },
  // Positioned as a percentage of the frame's own native "screen" area
  // (see FRAME_W/FRAME_H comment above) so it stays aligned regardless of
  // DISPLAY_W/DISPLAY_H.
  screenOverlay: {
    position: 'absolute',
    left: `${(10 / FRAME_W) * 100}%`,
    top: `${(170 / FRAME_H) * 100}%`,
    width: `${((290 - 10) / FRAME_W) * 100}%`,
    height: `${((260 - 170) / FRAME_H) * 100}%`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 26,
    color: '#f5ecd8',
    letterSpacing: 1,
    fontFamily: FONTS.bold,
  },
});
