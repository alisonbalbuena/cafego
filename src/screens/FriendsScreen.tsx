import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  FlatList,
  RefreshControl,
  StyleSheet,
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
import { FriendRequest, intensityMeta, isSessionPublic, StudySession, UserProfile } from '../types';
import { showAlert } from '../utils/alert';
import { formatDuration } from '../utils/format';
import { COLORS, RADIUS } from '../theme';
import SearchBar from '../components/SearchBar';
import StudyNotesStrip from '../components/StudyNotesStrip';
import { useRefresh } from '../hooks/useRefresh';

interface Friend {
  uid: string;
  displayName: string;
  username?: string;
}

interface UserSearchResult {
  uid: string;
  username: string;
  displayName: string;
  photoUrl?: string;
}

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  totalMs: number;
  cafeCount: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function FriendsScreen() {
  const { user, profile } = useAuth();
  const { refreshing, onRefresh } = useRefresh();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [activeByUid, setActiveByUid] = useState<Record<string, StudySession>>({});
  const [leaderboardSessions, setLeaderboardSessions] = useState<StudySession[]>([]);
  const [usernameSearch, setUsernameSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, UserProfile>>({});

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
        if (isSessionPublic(data)) next[data.uid] = data;
      });
      setActiveByUid(next);
    });
    return unsubscribe;
  }, [friends]);

  useEffect(() => {
    if (!user) return;
    const uids = [user.uid, ...friends.slice(0, 29).map((f) => f.uid)];
    const q = query(collection(db, 'studySessions'), where('uid', 'in', uids));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession)
        .filter((s) => s.uid === user.uid || isSessionPublic(s));
      setLeaderboardSessions(docs);
    });
    return unsubscribe;
  }, [user, friends]);

  useEffect(() => {
    if (friends.length === 0) {
      setFriendProfiles({});
      return;
    }
    const uids = friends.slice(0, 30).map((f) => f.uid);
    (async () => {
      const q = query(collection(db, 'users'), where('uid', 'in', uids));
      const snapshot = await getDocs(q);
      const next: Record<string, UserProfile> = {};
      snapshot.docs.forEach((d) => {
        next[d.id] = d.data() as UserProfile;
      });
      setFriendProfiles(next);
    })();
  }, [friends]);

  const leaderboardEntries = useMemo<LeaderboardEntry[]>(() => {
    if (!user) return [];
    const nameFor = (uid: string) =>
      uid === user.uid ? 'You' : friends.find((f) => f.uid === uid)?.displayName ?? 'Someone';
    const map: Record<string, { totalMs: number; cafeIds: Set<string> }> = {};
    leaderboardSessions.forEach((s) => {
      if (!map[s.uid]) map[s.uid] = { totalMs: 0, cafeIds: new Set() };
      map[s.uid].cafeIds.add(s.cafeId);
      if (s.endedAt != null) map[s.uid].totalMs += s.endedAt - s.startedAt;
    });
    return Object.entries(map).map(([uid, v]) => ({
      uid,
      displayName: nameFor(uid),
      totalMs: v.totalMs,
      cafeCount: v.cafeIds.size,
    }));
  }, [leaderboardSessions, friends, user]);

  const byTimeStudied = useMemo(
    () => [...leaderboardEntries].sort((a, b) => b.totalMs - a.totalMs),
    [leaderboardEntries]
  );
  const byCafesVisited = useMemo(
    () => [...leaderboardEntries].sort((a, b) => b.cafeCount - a.cafeCount),
    [leaderboardEntries]
  );

  const togetherCounts = useMemo(() => {
    if (!user) return {};
    const counts: Record<string, number> = {};
    leaderboardSessions.forEach((s) => {
      if (s.uid === user.uid) {
        s.withFriends?.forEach((f) => {
          counts[f.uid] = (counts[f.uid] ?? 0) + 1;
        });
      } else if (s.withFriends?.some((f) => f.uid === user.uid)) {
        counts[s.uid] = (counts[s.uid] ?? 0) + 1;
      }
    });
    return counts;
  }, [leaderboardSessions, user]);

  useEffect(() => {
    if (!user) return;
    const term = usernameSearch.trim().toLowerCase();
    if (!term) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', term),
        where('username', '<=', `${term}`)
      );
      const snapshot = await getDocs(q);
      if (cancelled) return;
      const friendUids = new Set(friends.map((f) => f.uid));
      const results = snapshot.docs
        .map((d) => d.data() as any)
        .filter((u) => u.uid !== user.uid && !friendUids.has(u.uid))
        .slice(0, 10)
        .map((u) => ({
          uid: u.uid,
          username: u.username,
          displayName: u.displayName,
          photoUrl: u.photoUrl,
        }));
      setSearchResults(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [usernameSearch, friends, user]);

  const sendRequestTo = async (target: UserSearchResult) => {
    if (!user) return;
    setSendingTo(target.uid);
    try {
      await addDoc(collection(db, 'friendRequests'), {
        fromUid: user.uid,
        fromDisplayName: user.displayName ?? 'Someone',
        fromUsername: profile?.username ?? null,
        toUid: target.uid,
        toDisplayName: target.displayName,
        toUsername: target.username,
        status: 'pending',
        createdAt: Date.now(),
      });
      showAlert('Request sent', `Friend request sent to ${target.displayName}.`);
    } catch (err: any) {
      showAlert('Could not send request', err.message);
    } finally {
      setSendingTo(null);
    }
  };

  const acceptRequest = async (request: FriendRequest) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'friends', request.fromUid), {
        uid: request.fromUid,
        displayName: request.fromDisplayName,
        username: request.fromUsername ?? null,
        since: Date.now(),
      });
      await setDoc(doc(db, 'users', request.fromUid, 'friends', user.uid), {
        uid: user.uid,
        displayName: user.displayName ?? 'Someone',
        username: profile?.username ?? null,
        since: Date.now(),
      });
      await updateDoc(doc(db, 'friendRequests', request.id), { status: 'accepted' });
    } catch (err: any) {
      showAlert('Could not accept request', err.message);
    }
  };

  const sendNudge = async (friend: Friend) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'nudges'), {
        fromUid: user.uid,
        fromDisplayName: user.displayName ?? 'Someone',
        toUid: friend.uid,
        createdAt: Date.now(),
      });
      showAlert('Nudge sent', `${friend.displayName} will see your nudge next time they open the app.`);
    } catch (err: any) {
      showAlert('Could not send nudge', err.message);
    }
  };

  const renderBoard = (title: string, entries: LeaderboardEntry[], valueFor: (e: LeaderboardEntry) => string) => (
    <View style={styles.boardCard}>
      <Text style={styles.boardTitle}>{title}</Text>
      {entries.length === 0 ? (
        <Text style={styles.emptyText}>No study sessions yet.</Text>
      ) : (
        entries.map((entry, i) => (
          <View
            key={entry.uid}
            style={[
              styles.leaderboardRow,
              i === entries.length - 1 && styles.leaderboardRowLast,
              entry.uid === user?.uid && styles.leaderboardRowMe,
            ]}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{MEDALS[i] ?? i + 1}</Text>
            </View>
            <View style={styles.leaderboardAvatar}>
              <Text style={styles.leaderboardAvatarText}>
                {entry.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.leaderboardName}>{entry.displayName}</Text>
            <Text style={styles.leaderboardValue}>{valueFor(entry)}</Text>
          </View>
        ))
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.uid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.heading}>Friends</Text>

            <Text style={styles.sectionTitle}>📝 Notes</Text>
            <View style={{ marginBottom: 16 }}>
              <StudyNotesStrip friends={friends} />
            </View>

            <SearchBar
              style={{ marginBottom: 8 }}
              placeholder="Search by username"
              autoCapitalize="none"
              value={usernameSearch}
              onChangeText={setUsernameSearch}
            />

            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.map((result) => (
                  <View key={result.uid} style={styles.searchRow}>
                    {result.photoUrl ? (
                      <Image source={{ uri: result.photoUrl }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarPlaceholderText}>
                          {result.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchUsername}>@{result.username}</Text>
                      <Text style={styles.searchRealName}>{result.displayName}</Text>
                    </View>
                    <Pressable
                      style={styles.addButton}
                      onPress={() => sendRequestTo(result)}
                      disabled={sendingTo === result.uid}
                    >
                      <Text style={styles.addButtonText}>
                        {sendingTo === result.uid ? '…' : 'Add'}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

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
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No friends yet — search a username above.
          </Text>
        }
        renderItem={({ item }) => {
          const session = activeByUid[item.uid];
          const together = togetherCounts[item.uid] ?? 0;
          const friendProfile = friendProfiles[item.uid];
          const showStreak =
            friendProfile?.streakVisibility === 'friends' && (friendProfile?.weeklyStreak ?? 0) > 0;
          return (
            <View style={styles.friendRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName}>{item.displayName}</Text>
                {session ? (
                  <>
                    <Text style={styles.friendStatus}>
                      📍 {session.cafeName} · {session.subject}
                    </Text>
                    <View style={styles.intensityPill}>
                      <Text style={styles.intensityPillText}>
                        {intensityMeta(session.intensity).emoji} {intensityMeta(session.intensity).label}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.friendStatusIdle}>Not studying right now</Text>
                )}
                {together > 0 && (
                  <Text style={styles.togetherText}>
                    📚 Studied together {together}×
                  </Text>
                )}
                {showStreak && (
                  <Text style={styles.togetherText}>🔥 {friendProfile!.weeklyStreak} week streak</Text>
                )}
              </View>
              <View style={styles.friendActions}>
                {session && <View style={styles.liveDot} />}
                <Pressable style={styles.nudgeButton} onPress={() => sendNudge(item)}>
                  <Text style={styles.nudgeButtonText}>👋 Nudge</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.leaderboardSection}>
            <View style={styles.leaderboardHeaderRow}>
              <Text style={styles.leaderboardEmoji}>🏆</Text>
              <Text style={styles.leaderboardHeading}>Leaderboard</Text>
            </View>
            {renderBoard('⏱️ Most time studied', byTimeStudied, (e) => formatDuration(e.totalMs))}
            {renderBoard('☕ Most cafes visited', byCafesVisited, (e) => `${e.cafeCount}`)}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  searchResults: { marginBottom: 16 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  avatarPlaceholderText: { fontSize: 16, color: COLORS.textFaint, fontWeight: '700' },
  searchUsername: { fontSize: 15, fontWeight: '600' },
  searchRealName: { fontSize: 12, color: COLORS.textFaint, opacity: 0.8, marginTop: 1 },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 8 },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  requestText: { fontSize: 15 },
  acceptButton: {
    backgroundColor: COLORS.primary,
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
    borderBottomColor: COLORS.borderLight,
  },
  friendName: { fontSize: 16, fontWeight: '500' },
  friendStatus: { fontSize: 13, color: COLORS.success, marginTop: 2 },
  friendStatusIdle: { fontSize: 13, color: COLORS.textFaint, marginTop: 2 },
  togetherText: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  friendActions: { alignItems: 'flex-end', gap: 6 },
  nudgeButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  nudgeButtonText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  intensityPill: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  intensityPillText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },
  emptyText: { color: COLORS.textFaint, textAlign: 'center', marginTop: 24 },

  leaderboardSection: { marginTop: 24 },
  leaderboardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  leaderboardEmoji: { fontSize: 24 },
  leaderboardHeading: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  boardCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
    marginBottom: 16,
  },
  boardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  leaderboardRowLast: { borderBottomWidth: 0 },
  leaderboardRowMe: { backgroundColor: COLORS.accentLight, borderRadius: RADIUS.md, paddingHorizontal: 8, marginHorizontal: -8 },
  rankBadge: {
    width: 28,
    alignItems: 'center',
  },
  rankBadgeText: { fontSize: 16, fontWeight: '700', color: COLORS.textMuted },
  leaderboardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardAvatarText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  leaderboardName: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text },
  leaderboardValue: { fontSize: 15, color: COLORS.success, fontWeight: '700' },
});
