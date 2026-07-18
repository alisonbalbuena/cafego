import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { CAFES } from '../data/cafes';
import { intensityMeta, isSessionPublic, StudySession } from '../types';
import { showAlert } from '../utils/alert';
import { COLORS } from '../theme';
import { distanceMiles } from '../utils/geo';

interface Friend {
  uid: string;
  displayName: string;
}

export default function MapScreen({ navigation }: any) {
  const { user } = useAuth();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriends, setActiveFriends] = useState<StudySession[]>([]);
  const [visitedCafeIds, setVisitedCafeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission needed', 'Allow location access to see nearby cafes on the map.');
        setLoading(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLocation(position);
      setLoading(false);
    })();
  }, []);

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
    if (!user) return;
    const q = query(collection(db, 'studySessions'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVisitedCafeIds(new Set(snapshot.docs.map((d) => (d.data() as any).cafeId as string)));
    });
    return unsubscribe;
  }, [user]);

  const nearestCafes = useMemo(() => {
    if (!location) return CAFES;
    const { latitude, longitude } = location.coords;
    return [...CAFES]
      .map((c) => ({ ...c, distance: distanceMiles(latitude, longitude, c.lat, c.lng) }))
      .sort((a, b) => a.distance - b.distance);
  }, [location]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
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
      <MapView style={styles.map} initialRegion={initialRegion} showsUserLocation>
        {nearestCafes.map((cafe) => {
          const visited = visitedCafeIds.has(cafe.id);
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
                  <Text style={styles.calloutLink}>Tap for details</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {activeFriends.map((session) => {
          const cafe = CAFES.find((c) => c.id === session.cafeId);
          if (!cafe) return null;
          return (
            <Marker
              key={session.id}
              coordinate={{ latitude: cafe.lat, longitude: cafe.lng }}
              pinColor="#2a7a2a"
            >
              <Callout>
                <View style={{ maxWidth: 200 }}>
                  <Text style={styles.calloutTitle}>{session.displayName}</Text>
                  <Text style={styles.calloutSubtitle}>
                    📍 {session.cafeName} · {session.subject}
                  </Text>
                  <Text style={styles.calloutIntensity}>
                    {intensityMeta(session.intensity).emoji} {intensityMeta(session.intensity).label}
                  </Text>
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
  calloutTitle: { fontWeight: '700', fontSize: 14 },
  calloutSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  calloutIntensity: { fontSize: 11, fontWeight: '600', color: COLORS.primary, marginTop: 4 },
  calloutLink: { fontSize: 11, color: COLORS.link, marginTop: 4 },
});
