import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, storage } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CafeProgram, MenuItem } from '../types';
import { showAlert } from '../utils/alert';
import { COLORS, FONTS } from '../theme';
import BackButton from '../components/BackButton';

export default function ManageMenuScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [program, setProgram] = useState<CafeProgram | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [onlineMenuUrl, setOnlineMenuUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile?.merchantCafeId) return;
    const unsubscribe = onSnapshot(doc(db, 'cafePrograms', profile.merchantCafeId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as CafeProgram;
        setProgram(data);
        setOnlineMenuUrl(data.onlineMenuUrl ?? '');
      }
    });
    return unsubscribe;
  }, [profile?.merchantCafeId]);

  useEffect(() => {
    if (!profile?.merchantCafeId) return;
    const q = query(collection(db, 'menuItems'), where('cafeId', '==', profile.merchantCafeId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsubscribe;
  }, [profile?.merchantCafeId]);

  const pickAndUploadImage = async () => {
    if (!profile?.merchantCafeId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission needed', 'Allow photo library access to upload a menu photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const fileRef = ref(storage, `menuImages/${profile.merchantCafeId}/${Date.now()}.jpg`);
      await uploadBytes(fileRef, blob);
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'cafePrograms', profile.merchantCafeId), {
        menuImageUrls: arrayUnion(url),
      });
    } catch (err: any) {
      showAlert('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (url: string) => {
    if (!profile?.merchantCafeId) return;
    try {
      await updateDoc(doc(db, 'cafePrograms', profile.merchantCafeId), {
        menuImageUrls: arrayRemove(url),
      });
    } catch (err: any) {
      showAlert('Could not remove photo', err.message);
    }
  };

  const saveOnlineMenuUrl = async () => {
    if (!profile?.merchantCafeId) return;
    setSavingUrl(true);
    try {
      const trimmed = onlineMenuUrl.trim();
      const normalized = trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
      await updateDoc(doc(db, 'cafePrograms', profile.merchantCafeId), {
        onlineMenuUrl: normalized,
      });
      setOnlineMenuUrl(normalized);
      showAlert('Saved', 'Your online menu link has been updated.');
    } catch (err: any) {
      showAlert('Could not save link', err.message);
    } finally {
      setSavingUrl(false);
    }
  };

  const addItem = async () => {
    if (!profile?.merchantCafeId) return;
    if (!name.trim() || !price.trim()) {
      showAlert('Missing info', 'Enter at least a name and price.');
      return;
    }
    setSubmitting(true);
    try {
      const itemRef = doc(collection(db, 'menuItems'));
      await setDoc(itemRef, {
        cafeId: profile.merchantCafeId,
        name: name.trim(),
        description: description.trim(),
        price: Number(price) || 0,
        createdAt: Date.now(),
      });
      setName('');
      setPrice('');
      setDescription('');
    } catch (err: any) {
      showAlert('Could not add item', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'menuItems', itemId));
    } catch (err: any) {
      showAlert('Could not delete', err.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.headingRow}>
              <BackButton navigation={navigation} />
              <Text style={styles.heading}>Menu</Text>
            </View>

            <Text style={styles.sectionTitle}>Menu photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {(program?.menuImageUrls ?? []).map((url) => (
                <View key={url} style={styles.photoWrap}>
                  <Image source={{ uri: url }} style={styles.photo} />
                  <Pressable style={styles.removePhoto} onPress={() => removeImage(url)}>
                    <Text style={styles.removePhotoText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.secondaryButton} onPress={pickAndUploadImage} disabled={uploading}>
              <Text style={styles.secondaryButtonText}>
                {uploading ? 'Uploading…' : '+ Upload menu photo'}
              </Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Online menu link</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. yourcafe.com/menu"
              autoCapitalize="none"
              value={onlineMenuUrl}
              onChangeText={setOnlineMenuUrl}
            />
            <Pressable style={styles.secondaryButton} onPress={saveOnlineMenuUrl} disabled={savingUrl}>
              <Text style={styles.secondaryButtonText}>{savingUrl ? 'Saving…' : 'Save link'}</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Menu items</Text>
            <TextInput
              style={styles.input}
              placeholder="Item name"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Price"
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
            />
            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              value={description}
              onChangeText={setDescription}
            />
            <Pressable style={styles.button} onPress={addItem} disabled={submitting}>
              <Text style={styles.buttonText}>{submitting ? 'Adding…' : 'Add item'}</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No menu items yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              {!!item.description && (
                <Text style={styles.itemDescription}>{item.description}</Text>
              )}
            </View>
            <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            <Pressable onPress={() => remove(item.id)}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', flexShrink: 1, fontFamily: FONTS.bold, letterSpacing: 1.0 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 8, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButtonText: { color: COLORS.text, fontWeight: '600', fontSize: 14, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  photoWrap: { marginRight: 8, position: 'relative' },
  photo: { width: 100, height: 100, borderRadius: 10, backgroundColor: COLORS.card },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: { color: '#fff', fontSize: 12, lineHeight: 12, fontFamily: FONTS.regular },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  itemName: { fontSize: 14, fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  itemDescription: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  itemPrice: { fontSize: 14, fontWeight: '600', marginRight: 12, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  delete: { color: COLORS.danger, fontSize: 13, fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  emptyText: { color: COLORS.textFaint, textAlign: 'center', marginTop: 12, fontFamily: FONTS.regular, letterSpacing: 0.3 },
});
