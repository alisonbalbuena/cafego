import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { showAlert } from '../utils/alert';
import { COLORS, RADIUS } from '../theme';
import BackButton from '../components/BackButton';

export default function AddMenuPhotoScreen({ route, navigation }: any) {
  const { cafeId, cafeName } = route.params;
  const { user } = useAuth();
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission needed', 'Allow photo library access to add a menu photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;
    setPickedUri(result.assets[0].uri);
  };

  const submit = async () => {
    if (!user || !pickedUri) return;
    setUploading(true);
    try {
      const response = await fetch(pickedUri);
      const blob = await response.blob();
      const fileRef = ref(storage, `menuImages/${cafeId}/community_${user.uid}_${Date.now()}.jpg`);
      await uploadBytes(fileRef, blob);
      const url = await getDownloadURL(fileRef);
      await addDoc(collection(db, 'menuPhotos'), {
        cafeId,
        uid: user.uid,
        displayName: user.displayName ?? 'Someone',
        url,
        createdAt: Date.now(),
      });
      navigation.goBack();
    } catch (err: any) {
      showAlert('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <BackButton navigation={navigation} />
        <Text style={styles.heading}>Add a menu photo</Text>
      </View>
      <Text style={styles.subtitle}>{cafeName}</Text>

      <Pressable style={styles.pickArea} onPress={pickPhoto}>
        {pickedUri ? (
          <Image source={{ uri: pickedUri }} style={styles.preview} />
        ) : (
          <Text style={styles.pickAreaText}>📷 Tap to choose a photo</Text>
        )}
      </Pressable>

      {pickedUri && (
        <Pressable style={styles.secondaryButton} onPress={pickPhoto}>
          <Text style={styles.secondaryButtonText}>Choose a different photo</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.button, !pickedUri && styles.buttonDisabled]}
        onPress={submit}
        disabled={!pickedUri || uploading}
      >
        <Text style={styles.buttonText}>{uploading ? 'Uploading…' : 'Upload photo'}</Text>
      </Pressable>

      <Pressable style={styles.cancelButton} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', flexShrink: 1 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, marginBottom: 20 },
  pickArea: {
    height: 220,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  pickAreaText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
  preview: { width: '100%', height: '100%' },
  secondaryButton: { alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: COLORS.link, fontSize: 13, fontWeight: '600' },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { backgroundColor: COLORS.textFaint },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancelButton: { alignItems: 'center', marginTop: 16 },
  cancelButtonText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
});
