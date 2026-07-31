import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet } from 'react-native';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { showAlert } from '../utils/alert';
import { COLORS, FONTS } from '../theme';

/** "Can't find a cafe?" link + submission form, for anywhere a cafe search
 * comes up empty — writes to `cafeRequests` for the admin to review. */
export default function CafeRequestButton() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) return;
    const cleanName = name.trim();
    const cleanAddress = address.trim();
    if (!cleanName || !cleanAddress) {
      showAlert('Missing info', "Enter the cafe's name and address.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'cafeRequests'), {
        name: cleanName,
        address: cleanAddress,
        submittedByUid: user.uid,
        submittedByName: user.displayName ?? 'Someone',
        status: 'pending',
        createdAt: Date.now(),
      });
      showAlert('Sent!', "Thanks — we'll review it and add it if it's a good fit.");
      setName('');
      setAddress('');
      setShowModal(false);
    } catch (err: any) {
      showAlert('Could not send request', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Pressable style={styles.link} onPress={() => setShowModal(true)}>
        <Text style={styles.linkText}>Can't find a cafe?</Text>
      </Pressable>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.heading}>Suggest a cafe</Text>
            <Text style={styles.hint}>Tell us about the cafe and we'll review it for you.</Text>
            <Text style={styles.label}>Cafe name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Alchemist Coffee"
              placeholderTextColor={COLORS.textFaint}
              value={name}
              onChangeText={setName}
            />
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Street, city, state"
              placeholderTextColor={COLORS.textFaint}
              value={address}
              onChangeText={setAddress}
            />
            <Pressable
              style={[styles.button, (!name.trim() || !address.trim()) && styles.buttonDisabled]}
              onPress={submit}
              disabled={submitting || !name.trim() || !address.trim()}
            >
              <Text style={styles.buttonText}>{submitting ? 'Sending…' : 'Submit for review'}</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    textDecorationLine: 'underline',
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.3,
  },
  overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20 },
  heading: { fontSize: 20, fontWeight: '700', fontFamily: FONTS.bold, letterSpacing: 0.8, color: COLORS.text },
  hint: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 12,
    marginBottom: 6,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  cancelButton: { alignItems: 'center', marginTop: 12, padding: 8 },
  cancelButtonText: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.3,
  },
});
