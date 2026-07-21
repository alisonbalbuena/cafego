import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { CAFES } from '../data/cafes';
import { distanceMiles } from '../utils/geo';
import { COLORS, RADIUS } from '../theme';

interface Props {
  onPress: () => void;
}

export default function MapPreview({ onPress }: Props) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return;
      const position = await Location.getCurrentPositionAsync({});
      setLocation(position);
    })();
  }, []);

  const nearestCafes = useMemo(() => {
    if (!location) return CAFES.slice(0, 8);
    const { latitude, longitude } = location.coords;
    return [...CAFES]
      .map((c) => ({ ...c, distance: distanceMiles(latitude, longitude, c.lat, c.lng) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
  }, [location]);

  const initialRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }
    : {
        latitude: CAFES[0].lat,
        longitude: CAFES[0].lng,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      };

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        pointerEvents="none"
      >
        {nearestCafes.map((cafe) => (
          <Marker
            key={cafe.id}
            coordinate={{ latitude: cafe.lat, longitude: cafe.lng }}
            pinColor={COLORS.accent}
          />
        ))}
      </MapView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 140,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  map: { flex: 1 },
});
