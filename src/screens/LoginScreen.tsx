import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { showAlert } from '../utils/alert';
import { COLORS, RADIUS } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier || !password) {
      showAlert('Missing info', 'Enter your email or username and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
    } catch (err: any) {
      showAlert('Login failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.logoBubble}>
        <Ionicons name="cafe" size={32} color={COLORS.white} />
      </View>
      <Text style={styles.title}>Study Cafe</Text>
      <Text style={styles.subtitle}>Find your friends. Find your cafe.</Text>

      <View style={styles.inputWrap}>
        <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Email or username"
          placeholderTextColor={COLORS.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          value={identifier}
          onChangeText={setIdentifier}
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

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Logging in…' : 'Log in'}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.link}>Don't have an account? Sign up</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: COLORS.bg },
  logoBubble: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 32 },
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
  buttonText: { color: COLORS.white, fontWeight: '600', fontSize: 16 },
  link: { color: COLORS.textMuted, textAlign: 'center', marginTop: 16 },
});
