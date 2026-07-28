import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { showAlert } from '../utils/alert';
import { COLORS, RADIUS, FONTS } from '../theme';
import BackButton from '../components/BackButton';

export default function SignUpScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!firstName || !lastName || !username || !email || !password) {
      showAlert('Missing info', 'Fill in your name, username, email, and password.');
      return;
    }
    if (password.length < 6) {
      showAlert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, firstName.trim(), lastName.trim(), username.trim());
    } catch (err: any) {
      showAlert('Sign up failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.backButtonWrap, { top: insets.top + 8 }]}>
        <BackButton navigation={navigation} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBubble}>
          <Ionicons name="cafe" size={28} color={COLORS.white} />
        </View>
        <Text style={styles.title}>Create account</Text>

        <View style={styles.row}>
          <View style={[styles.inputWrap, { flex: 1 }]}>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor={COLORS.textFaint}
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>
          <View style={[styles.inputWrap, { flex: 1 }]}>
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor={COLORS.textFaint}
              value={lastName}
              onChangeText={setLastName}
            />
          </View>
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="at-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={COLORS.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <Pressable style={styles.button} onPress={handleSignUp} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Sign up'}</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Already have an account? Log in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  backButtonWrap: { position: 'absolute', left: 16, zIndex: 10 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoBubble: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.text,
    marginBottom: 28,
    fontFamily: FONTS.bold,
    letterSpacing: 1.1,
  },
  row: { flexDirection: 'row', gap: 12 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: COLORS.text },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.6,
  },
  link: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: FONTS.regular,
    letterSpacing: 0.4,
  },
});
