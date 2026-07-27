import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
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
import { ensureCalendarPermission } from '../utils/calendarSync';
import {
  hasSelection,
  isScreenTimeSupported,
  presentActivityPicker,
  requestAuthorization,
} from 'screen-time';
import { COLORS } from '../theme';
import BackButton from '../components/BackButton';

export default function EditProfileScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [community, setCommunity] = useState(profile?.community ?? '');
  const [budgetAmount, setBudgetAmount] = useState(
    profile?.budgetAmount != null ? String(profile.budgetAmount) : ''
  );
  const [budgetPeriod, setBudgetPeriod] = useState<'weekly' | 'monthly'>(
    profile?.budgetPeriod ?? 'weekly'
  );
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl);
  const [calendarLogging, setCalendarLogging] = useState(profile?.calendarLogging ?? false);
  const [screenTimeShieldEnabled, setScreenTimeShieldEnabled] = useState(
    profile?.screenTimeShieldEnabled ?? false
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Saved immediately (not on the Save button) because enabling has to run
  // the calendar permission prompt right then — that's the "connect" step.
  const toggleCalendarLogging = async (next: boolean) => {
    if (!user) return;
    if (next) {
      if (Platform.OS === 'web') {
        showAlert('Not available on web', 'Calendar logging works from the mobile app.');
        return;
      }
      const granted = await ensureCalendarPermission();
      if (!granted) {
        showAlert(
          'Calendar access needed',
          'Allow calendar access so finished study sessions can be added automatically.'
        );
        return;
      }
    }
    setCalendarLogging(next);
    try {
      await updateDoc(doc(db, 'users', user.uid), { calendarLogging: next });
    } catch (err: any) {
      setCalendarLogging(!next);
      showAlert('Could not update setting', err.message);
    }
  };

  // Enabling has to run the Screen Time consent prompt and (the first time)
  // the app picker right then — that's the "connect" step, same idea as
  // calendar logging above.
  const toggleScreenTimeShield = async (next: boolean) => {
    if (!user) return;
    if (next) {
      if (!isScreenTimeSupported()) {
        showAlert(
          'Not available here',
          'Screen Time shielding needs the iOS build with Screen Time enabled — not Expo Go or web.'
        );
        return;
      }
      const authorized = await requestAuthorization();
      if (!authorized) {
        showAlert(
          'Screen Time access needed',
          'Allow Screen Time access so distracting apps can be shielded during your sessions.'
        );
        return;
      }
      if (!hasSelection()) {
        const picked = await presentActivityPicker();
        if (!picked) return;
      }
    }
    setScreenTimeShieldEnabled(next);
    try {
      await updateDoc(doc(db, 'users', user.uid), { screenTimeShieldEnabled: next });
    } catch (err: any) {
      setScreenTimeShieldEnabled(!next);
      showAlert('Could not update setting', err.message);
    }
  };

  const chooseShieldedApps = async () => {
    if (!isScreenTimeSupported()) {
      showAlert(
        'Not available here',
        'Screen Time shielding needs the iOS build with Screen Time enabled — not Expo Go or web.'
      );
      return;
    }
    await presentActivityPicker();
  };

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
      const parsedBudget = Number(budgetAmount);
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName,
        username: cleanUsername,
        bio: bio.trim(),
        community: community.trim().slice(0, 60),
        budgetAmount: budgetAmount.trim() && parsedBudget > 0 ? parsedBudget : null,
        budgetPeriod,
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

        <Text style={styles.label}>Spending budget (optional)</Text>
        <View style={styles.periodRow}>
          <Pressable
            style={[styles.periodChip, budgetPeriod === 'weekly' && styles.periodChipSelected]}
            onPress={() => setBudgetPeriod('weekly')}
          >
            <Text
              style={[
                styles.periodChipText,
                budgetPeriod === 'weekly' && styles.periodChipTextSelected,
              ]}
            >
              Weekly
            </Text>
          </Pressable>
          <Pressable
            style={[styles.periodChip, budgetPeriod === 'monthly' && styles.periodChipSelected]}
            onPress={() => setBudgetPeriod('monthly')}
          >
            <Text
              style={[
                styles.periodChipText,
                budgetPeriod === 'monthly' && styles.periodChipTextSelected,
              ]}
            >
              Monthly
            </Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          value={budgetAmount}
          onChangeText={setBudgetAmount}
          keyboardType="decimal-pad"
          placeholder="e.g. 40"
          placeholderTextColor={COLORS.textFaint}
        />
        <Text style={styles.budgetHint}>
          We'll show a friendly reminder of how much you have left when you start a session — just
          a nudge, never a limit.
        </Text>

        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchLabel}>Log sessions to my calendar</Text>
            <Text style={styles.switchHint}>
              Finished study sessions are added to your device calendar automatically — if it
              syncs with Google Calendar, they'll show up there too.
            </Text>
          </View>
          <Switch
            value={calendarLogging}
            onValueChange={toggleCalendarLogging}
            trackColor={{ true: COLORS.primary }}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchLabel}>Shield distracting apps during sessions</Text>
            <Text style={styles.switchHint}>
              Pick apps that tempt you away — they'll be blocked with Screen Time's shield while
              you're checked in, and unlocked the moment you end the session.
            </Text>
          </View>
          <Switch
            value={screenTimeShieldEnabled}
            onValueChange={toggleScreenTimeShield}
            trackColor={{ true: COLORS.primary }}
          />
        </View>
        {screenTimeShieldEnabled && (
          <Pressable style={styles.secondaryButton} onPress={chooseShieldedApps}>
            <Text style={styles.secondaryButtonText}>Change shielded apps</Text>
          </Pressable>
        )}

        <Pressable style={styles.button} onPress={save} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', flexShrink: 1 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.card },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  avatarPlaceholderText: { fontSize: 28, color: COLORS.textFaint },
  avatarHint: { fontSize: 13, color: COLORS.link, fontWeight: '600', marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  periodChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  periodChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodChipText: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  periodChipTextSelected: { color: '#fff' },
  budgetHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 6, lineHeight: 17 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  switchTextWrap: { flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  switchHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, lineHeight: 16 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
