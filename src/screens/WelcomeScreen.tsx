import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Pressable, Animated, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../theme';

const DARK_BROWN = '#2a1810';
// Matches the mascot GIF's baked-in background so it blends seamlessly.
const CREAM = '#fffcf6';
const CREAM_MUTED = '#e8dcc8';
const CREAM_FAINT = '#b8a68d';

export default function WelcomeScreen({ navigation }: any) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, rise]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeIn, transform: [{ translateY: rise }] }]}>
        <View style={styles.mascotBadge}>
          <Image
            source={require('../../assets/mascot-wave.gif')}
            style={styles.mascot}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Study Cafe</Text>
        <Text style={styles.tagline}>Your cozy corner for getting things done.</Text>
        <Text style={styles.blurb}>
          Grab your spot, start a session, and focus with friends or just you and your coffee.
        </Text>

        <Pressable style={styles.continueButton} onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
          <Text style={styles.loginLink}>
            Already have an account? <Text style={styles.loginLinkBold}>Log in</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BROWN,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  content: { alignItems: 'center', width: '100%', maxWidth: 400 },
  mascotBadge: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mascot: { width: 210, height: 217 },
  title: { fontSize: 36, fontWeight: '700', color: CREAM, marginTop: 16 },
  tagline: { fontSize: 16, fontWeight: '600', color: COLORS.accent, marginTop: 6, textAlign: 'center' },
  blurb: {
    fontSize: 14,
    color: CREAM_MUTED,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  continueButton: {
    backgroundColor: CREAM,
    borderRadius: RADIUS.pill,
    paddingVertical: 15,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 32,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  continueText: { color: DARK_BROWN, fontSize: 16, fontWeight: '700' },
  loginLink: { fontSize: 13, color: CREAM_FAINT, marginTop: 18 },
  loginLinkBold: { color: COLORS.accent, fontWeight: '700' },
});
