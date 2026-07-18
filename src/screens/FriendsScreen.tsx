import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { FriendRequest, StudySession } from '../types';

interface Friend {
  uid: string;
  displayName: string;
}

export default function FriendsScreen() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [activeByUid, setActiveByUid] = useState<Record<string, StudySession>>({});
  const [emailInput, setEmailInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubFriends = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snapshot) => {
        setFriends(snapshot.docs.map((d) => d.data() as Friend));
      }
    );
    const requestsQuery = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      setIncoming(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      );
    });
    return () => {
      unsubFriends();
      unsubRequests();
    };
  }, [user]);

  useEffect(() => {
    if (friends.length === 0) {
      setActiveByUid({});
      return;
    }
    const uids = friends.slice(0, 30).map((f) => f.uid);
    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('uid', 'in', uids),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
      const next: Record<string, StudySession> = {};
      snapshot.docs.forEach((d) => {
        const data = { id: d.id, ...(d.data() as any) } as StudySession;
        next[data.uid] = data;
      });
      setActiveByUid(next);
    });
    return unsubscribe;
  }, [friends]);

  const sendRequest = async () => {
    if (!user || !emailInput.trim()) return;
    const targetEmail = emailInput.trim().toLowerCase();
    if (targetEmail === user.email?.toLowerCase()) {
      Alert.alert('That\'s you', 'Enter a friend\'s email, not your own.');
      return;
    }
    setSending(true);
    try {
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', targetEmail))
      );
      if (usersSnap.empty) {
        Alert.alert('No account found', `No user is registered with ${targetEmail}.`);
        return;
      }
      const target = usersSnap.docs[0].data() as any;
      await addDoc(collection(db, 'friendRequests'), {
        fromUid: user.uid,
        fromDisplayName: user.displayName ?? 'Someone',
        toUid: target.uid,
        toDisplayName: target.displayName,
        status: 'pending',
        createdAt: Date.now(),
      });
      setEmailInput('');
      Alert.alert('Request sent', `Friend request sent to ${target.displayName}.`);
    } catch (err: any) {
      Alert.alert('Could not send request', err.message);
    } finally {
      setSending(false);
    }
  };

  const acceptRequest = async (request: FriendRequest) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'friends', request.fromUid), {
        uid: request.fromUid,
        displayName: request.fromDisplayName,
        since: Date.now(),
      });
      await setDoc(doc(db, 'users', request.fromUid, 'friends', user.uid), {
        uid: user.uid,
        displayName: user.displayName ?? 'Someone',
        since: Date.now(),
      });
      await updateDoc(doc(db, 'friendRequests', request.id), { status: 'accepted' });
    } catch (err: any) {
      Alert.alert('Could not accept request', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Friends</Text>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Add friend by email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={emailInput}
          onChangeText={setEmailInput}
        />
        <Pressable style={styles.addButton} onPress={sendRequest} disabled={sending}>
          <Text style={styles.addButtonText}>{sending ? '...' : 'Add'}</Text>
        </Pressable>
      </View>

      {incoming.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requests</Text>
          {incoming.map((req) => (
            <View key={req.id} style={styles.requestRow}>
              <Text style={styles.requestText}>{req.fromDisplayName}</Text>
              <Pressable style={styles.acceptButton} onPress={() => acceptRequest(req)}>
                <Text style={styles.acceptButtonText}>Accept</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Studying now</Text>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.uid}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No friends yet — add one by email above.
          </Text>
        }
        renderItem={({ item }) => {
          const session = activeByUid[item.uid];
          return (
            <View style={styles.friendRow}>
              <View>
                <Text style={styles.friendName}>{item.displayName}</Text>
                {session ? (
                  <Text style={styles.friendStatus}>
                    📍 {session.cafeName} · {session.subject}
                  </Text>
                ) : (
                  <Text style={styles.friendStatusIdle}>Not studying right now</Text>
                )}
              </View>
              {session && <View style={styles.liveDot} />}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  addButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8 },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  requestText: { fontSize: 15 },
  acceptButton: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  acceptButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  friendName: { fontSize: 16, fontWeight: '500' },
  friendStatus: { fontSize: 13, color: '#2a7a2a', marginTop: 2 },
  friendStatusIdle: { fontSize: 13, color: '#999', marginTop: 2 },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2a7a2a',
  },
  emptyText: { color: '#999', textAlign: 'center', marginTop: 24 },
});
