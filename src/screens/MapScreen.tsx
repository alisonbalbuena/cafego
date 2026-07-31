import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CAFES, HOME_LOCATION } from '../data/cafes';
import { busynessMeta, Cafe, intensityMeta, isSessionPublic, StudySession } from '../types';
import { showAlert } from '../utils/alert';
import { COLORS, FONTS } from '../theme';
import { distanceMiles } from '../utils/geo';
import { isGooglePlacesConfigured, searchNearbyCafes } from '../utils/googlePlaces';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackButton from '../components/BackButton';
import PixelBean from '../components/PixelBean';

interface Friend {
  uid: string;
  displayName: string;
}

type MapScope = 'friend' | 'community' | 'everyone';

const SCOPE_META: Record<MapScope, { color: string; label: string }> = {
  friend: { color: '#2a7a2a', label: '👥 Friend' },
  community: { color: '#7a4a9a', label: '🏫 Community' },
  everyone: { color: '#2a6a9a', label: '🌍 Public' },
};

export default function MapScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriends, setActiveFriends] = useState<StudySession[]>([]);
  const [communitySessions, setCommunitySessions] = useState<StudySession[]>([]);
  const [everyoneSessions, setEveryoneSessions] = useState<StudySession[]>([]);
  const [visitedCafeIds, setVisitedCafeIds] = useState<Set<string>>(new Set());
  const [liveNearbyCafes, setLiveNearbyCafes] = useState<Cafe[] | null>(null);

  useEffect(() => {
    (async () => {
      console.log('[MapScreen] requesting location permission…');
      const permission = await Location.requestForegroundPermissionsAsync();
      console.log('[MapScreen] permission result:', permission.status, 'granted:', permission.granted);
      if (!permission.granted) {
        showAlert('Permission needed', 'Allow location access to see nearby cafes on the map.');
        setLoading(false);
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({});
        console.log('[MapScreen] got position:', position.coords.latitude, position.coords.longitude);
        setLocation(position);
      } catch (err) {
        console.log('[MapScreen] getCurrentPositionAsync threw:', err);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!location) return;
    if (!isGooglePlacesConfigured()) {
      console.log('[MapScreen] Google Places not configured — using static cafe list.');
      return;
    }
    console.log('[MapScreen] fetching live nearby cafes at', location.coords.latitude, location.coords.longitude);
    searchNearbyCafes(location.coords.latitude, location.coords.longitude).then((cafes) => {
      console.log(`[MapScreen] live nearby cafes fetched: ${cafes.length}`, cafes.map((c) => c.name));
      if (cafes.length > 0) setLiveNearbyCafes(cafes);
    });
  }, [location]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snapshot) => setFriends(snapshot.docs.map((d) => d.data() as Friend))
    );
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (friends.length === 0) {
      setActiveFriends([]);
      return;
    }
    const uids = friends.slice(0, 30).map((f) => f.uid);
    const q = query(
      collection(db, 'studySessions'),
      where('uid', 'in', uids),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession)
        .filter(isSessionPublic);
      setActiveFriends(docs);
    });
    return unsubscribe;
  }, [friends]);

  useEffect(() => {
    if (!profile?.community) {
      setCommunitySessions([]);
      return;
    }
    const q = query(
      collection(db, 'studySessions'),
      where('visibility', '==', 'community'),
      where('community', '==', profile.community),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCommunitySessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession));
    });
    return unsubscribe;
  }, [profile?.community]);

  useEffect(() => {
    const q = query(
      collection(db, 'studySessions'),
      where('visibility', '==', 'everyone'),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEveryoneSessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as StudySession));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'studySessions'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVisitedCafeIds(new Set(snapshot.docs.map((d) => (d.data() as any).cafeId as string)));
    });
    return unsubscribe;
  }, [user]);

  const visibleSessions = useMemo(() => {
    const scopeById = new Map<string, MapScope>();
    activeFriends.forEach((s) => scopeById.set(s.id, 'friend'));
    communitySessions.forEach((s) => {
      if (!scopeById.has(s.id)) scopeById.set(s.id, 'community');
    });
    everyoneSessions.forEach((s) => {
      if (!scopeById.has(s.id)) scopeById.set(s.id, 'everyone');
    });
    const byId = new Map<string, StudySession>();
    [...activeFriends, ...communitySessions, ...everyoneSessions].forEach((s) => {
      if (s.uid !== user?.uid) byId.set(s.id, s);
    });
    return Array.from(byId.values()).map((s) => ({ session: s, scope: scopeById.get(s.id)! }));
  }, [activeFriends, communitySessions, everyoneSessions, user]);

  const busynessByCafe = useMemo(() => {
    const map = new Map<string, { session: StudySession; scope: MapScope }>();
    visibleSessions.forEach(({ session, scope }) => {
      if (!session.busynessReport) return;
      const existing = map.get(session.cafeId);
      if (!existing || session.startedAt > existing.session.startedAt) {
        map.set(session.cafeId, { session, scope });
      }
    });
    return map;
  }, [visibleSessions]);

  const nearestCafes = useMemo(() => {
    const base = liveNearbyCafes ?? CAFES;
    if (!location) return base;
    const { latitude, longitude } = location.coords;
    return [...base]
      .map((c) => ({ ...c, distance: distanceMiles(latitude, longitude, c.lat, c.lng) }))
      .sort((a, b) => a.distance - b.distance);
  }, [location, liveNearbyCafes]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <View style={[styles.backButtonWrap, { top: insets.top + 8 }]}>
          <BackButton navigation={navigation} />
        </View>
      </View>
    );
  }

  const initialRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : {
        latitude: CAFES[0].lat,
        longitude: CAFES[0].lng,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      };

  return (
    <View style={styles.container}>
      <View style={[styles.backButtonWrap, { top: insets.top + 8 }]}>
        <BackButton navigation={navigation} />
      </View>
      <MapView style={styles.map} initialRegion={initialRegion} showsUserLocation>
        {nearestCafes.map((cafe) => {
          const visited = visitedCafeIds.has(cafe.id);
          const busy = busynessByCafe.get(cafe.id);
          const busyMeta = busy ? busynessMeta(busy.session.busynessReport) : undefined;
          return (
            <Marker
              key={cafe.id}
              coordinate={{ latitude: cafe.lat, longitude: cafe.lng }}
              pinColor={visited ? COLORS.link : COLORS.accent}
              onCalloutPress={() =>
                navigation.navigate('CafeProfile', { cafeId: cafe.id, cafeName: cafe.name })
              }
            >
              <Callout>
                <View style={{ maxWidth: 200 }}>
                  <Text style={styles.calloutTitle}>
                    {cafe.name}
                    {visited ? ' · visited' : ''}
                  </Text>
                  <Text style={styles.calloutSubtitle}>
                    {cafe.neighborhood}
                    {'distance' in cafe ? ` · ${(cafe as any).distance.toFixed(1)} mi` : ''}
                  </Text>
                  {busyMeta && (
                    <View style={styles.calloutBusynessRow}>
                      <PixelBean color={busyMeta.color} size={12} />
                      <Text style={styles.calloutBusyness}>
                        {busyMeta.label} · {SCOPE_META[busy!.scope].label}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.calloutLink}>Tap for details</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {visibleSessions.map(({ session, scope }) => {
          if (session.cafeId === HOME_LOCATION.id) return null;
          const fallbackCafe = CAFES.find((c) => c.id === session.cafeId);
          const lat = session.cafeLat ?? fallbackCafe?.lat;
          const lng = session.cafeLng ?? fallbackCafe?.lng;
          if (lat == null || lng == null) return null;
          const busyMeta = busynessMeta(session.busynessReport);
          return (
            <Marker
              key={session.id}
              coordinate={{ latitude: lat, longitude: lng }}
              pinColor={SCOPE_META[scope].color}
            >
              <Callout>
                <View style={{ maxWidth: 200 }}>
                  <Text style={styles.calloutTitle}>{session.displayName}</Text>
                  <Text style={styles.calloutSubtitle}>
                    📍 {session.cafeName} · {session.subject}
                  </Text>
                  <Text style={styles.calloutIntensity}>
                    {intensityMeta(session.intensity).emoji
                      ? `${intensityMeta(session.intensity).emoji} `
                      : ''}
                    {intensityMeta(session.intensity).label}
                  </Text>
                  {busyMeta && (
                    <View style={styles.calloutBusynessRow}>
                      <PixelBean color={busyMeta.color} size={12} />
                      <Text style={styles.calloutBusyness}>{busyMeta.label}</Text>
                    </View>
                  )}
                  <Text style={styles.calloutScope}>{SCOPE_META[scope].label}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backButtonWrap: { position: 'absolute', left: 16, zIndex: 10 },
  calloutTitle: { fontWeight: '700', fontSize: 14, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  calloutSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  calloutIntensity: { fontSize: 11, fontWeight: '600', color: COLORS.primary, marginTop: 4, fontFamily: FONTS.semiBold, letterSpacing: 0.2 },
  calloutBusynessRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  calloutBusyness: { fontSize: 11, fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.2 },
  calloutScope: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, fontFamily: FONTS.regular },
  calloutLink: { fontSize: 11, color: COLORS.link, marginTop: 4, fontFamily: FONTS.regular, letterSpacing: 0.2 },
});
