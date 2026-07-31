import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile as updateAuthProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { showAlert } from '../utils/alert';
import { COLORS, FONTS } from '../theme';
import BackButton from '../components/BackButton';

export default function EditProfileScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [community, setCommunity] = useState(profile?.community ?? '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickAndUploadPhoto = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const fileRef = ref(storage, `profilePhotos/${user.uid}/photo.jpg`);
      await uploadBytes(fileRef, blob);
      const url = await getDownloadURL(fileRef);
      setPhotoUrl(url);
      await updateDoc(doc(db, 'users', user.uid), { photoUrl: url });
    } catch (err: any) {
      showAlert('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      showAlert('Missing info', 'First name, last name, and username are required.');
      return;
    }
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername) {
      showAlert('Invalid username', 'Username can only contain letters, numbers, and underscores.');
      return;
    }
    setSaving(true);
    try {
      if (cleanUsername !== profile?.username) {
        const existing = await getDocs(
          query(collection(db, 'users'), where('username', '==', cleanUsername))
        );
        if (!existing.empty) {
          showAlert('Username taken', 'Someone else already has that username.');
          setSaving(false);
          return;
        }
      }
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName,
        username: cleanUsername,
        bio: bio.trim(),
        community: community.trim().slice(0, 60),
      });
      if (auth.currentUser) {
        await updateAuthProfile(auth.currentUser, { displayName });
      }
      navigation.goBack();
    } catch (err: any) {
      showAlert('Could not save', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView>
        <View style={styles.headingRow}>
          <BackButton navigation={navigation} />
          <Text style={styles.heading}>Edit profile</Text>
        </View>

        <Pressable onPress={pickAndUploadPhoto} style={styles.avatarWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>{uploading ? '…' : '+'}</Text>
            </View>
          )}
          <Text style={styles.avatarHint}>{uploading ? 'Uploading…' : 'Change photo'}</Text>
        </Pressable>

        <Text style={styles.label}>First name</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />

        <Text style={styles.label}>Last name</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          multiline
          placeholder="Tell people a bit about yourself"
        />

        <Text style={styles.label}>Community</Text>
        <TextInput
          style={styles.input}
          value={community}
          onChangeText={setCommunity}
          placeholder="e.g. UGA, Emory Med School, Georgia State Law"
        />

        <Pressable style={styles.button} onPress={save} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', flexShrink: 1, fontFamily: FONTS.bold, letterSpacing: 1.0 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.card },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  avatarPlaceholderText: { fontSize: 28, color: COLORS.textFaint, fontFamily: FONTS.regular },
  avatarHint: { fontSize: 13, color: COLORS.link, fontWeight: '600', marginTop: 8, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
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
    padding: 12,
    fontSize: 15,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
});
