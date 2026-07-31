import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Pressable, Animated, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

const DARK_BROWN = '#2a1810';
// Cream badge behind the (now-transparent) mascot GIF, for contrast against
// the dark welcome background.
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
        <Text style={styles.title}>Focus Brew</Text>
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
    borderWidth: 4,
    borderColor: COLORS.accent,
  },
  mascot: { width: 210, height: 217 },
  title: { fontFamily: FONTS.bold, fontSize: 34, color: CREAM, marginTop: 16, letterSpacing: 1.2 },
  tagline: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.accent,
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  blurb: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: CREAM_MUTED,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 23,
    paddingHorizontal: 8,
    letterSpacing: 0.5,
  },
  continueButton: {
    backgroundColor: CREAM,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: DARK_BROWN,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 28,
    shadowColor: DARK_BROWN,
    shadowOpacity: 1,
    shadowOffset: { width: 3, height: 3 },
    shadowRadius: 0,
    elevation: 4,
  },
  continueText: { fontFamily: FONTS.semiBold, color: DARK_BROWN, fontSize: 16, letterSpacing: 0.6 },
  loginLink: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: CREAM_FAINT,
    marginTop: 18,
    letterSpacing: 0.4,
  },
  loginLinkBold: { fontFamily: FONTS.semiBold, color: COLORS.accent },
});
