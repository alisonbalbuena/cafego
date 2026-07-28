import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

interface Props {
  startedAt: number;
  pausedMs?: number;
  pausedAt?: number | null;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function Steam({ delay, offset, paused }: { delay: number; offset: number; paused: boolean }) {
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

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.8, 0.35, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.3] });

  return (
    <Animated.View
      style={[
        styles.steam,
        { left: offset, opacity, transform: [{ translateY }, { scale }] },
      ]}
    />
  );
}

export default function CoffeeMugTimer({ startedAt, pausedMs = 0, pausedAt = null }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isPaused = !!pausedAt;
  const currentPauseMs = isPaused ? now - pausedAt! : 0;
  const elapsed = now - startedAt - pausedMs - currentPauseMs;

  return (
    <View style={styles.container}>
      <View style={styles.steamRow}>
        <Steam delay={0} offset={6} paused={isPaused} />
        <Steam delay={500} offset={22} paused={isPaused} />
        <Steam delay={1000} offset={38} paused={isPaused} />
      </View>
      <View style={styles.mug}>
        <View style={styles.mugLiquid} />
        <View style={styles.handle} />
      </View>
      <Text style={styles.timeText}>{formatElapsed(elapsed)}</Text>
      {isPaused && <Text style={styles.pausedLabel}>⏸ Paused</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 16 },
  steamRow: { height: 34, width: 68 },
  steam: {
    position: 'absolute',
    bottom: 0,
    width: 8,
    height: 16,
    borderRadius: 4,
    backgroundColor: COLORS.textFaint,
  },
  mug: {
    width: 68,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 3,
    borderColor: COLORS.primary,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  mugLiquid: { height: '55%', backgroundColor: COLORS.primary },
  handle: {
    position: 'absolute',
    right: -16,
    top: 9,
    width: 18,
    height: 24,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  timeText: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 12, letterSpacing: 1, fontFamily: FONTS.semiBold },
  pausedLabel: { fontSize: 12, fontWeight: '600', color: COLORS.accent, marginTop: 4, fontFamily: FONTS.semiBold, letterSpacing: 0.3 },
});
