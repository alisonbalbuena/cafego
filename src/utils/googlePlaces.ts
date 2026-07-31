import { Cafe } from '../types';

const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.addressComponents,places.primaryType';

// Google's own type taxonomy for cafe-like venues. Used both to restrict the
// API request itself and, as a safety net, to drop anything that slips
// through with an unrelated primary type (gas stations, fast food, etc).
const CAFE_TYPES = new Set(['cafe', 'coffee_shop', 'coffee_roastery', 'coffee_stand']);

// Big franchise coffee chains are filtered out of live search results — the
// app is meant to surface local/independent cafes, same reasoning as the
// static list not including them.
const FRANCHISE_NAME_PATTERNS = [
  'starbucks',
  'dutch bros',
  '7 brew',
  'seven brew',
  'dunkin',
  "peet's coffee",
  'peets coffee',
  'tim hortons',
  'costa coffee',
  'caribou coffee',
  "scooter's coffee",
  'scooters coffee',
  'biggby coffee',
  "pj's coffee",
  'the human bean',
  'black rifle coffee',
  "ziggi's coffee",
];

function isFranchise(name: string): boolean {
  const lower = name.toLowerCase();
  return FRANCHISE_NAME_PATTERNS.some((pattern) => lower.includes(pattern));
}

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  addressComponents?: { longText: string; types?: string[] }[];
  primaryType?: string;
}

function getKey(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
}

export function isGooglePlacesConfigured(): boolean {
  return !!getKey();
}

function componentByType(place: GooglePlace, type: string): string | undefined {
  return place.addressComponents?.find((c) => c.types?.includes(type))?.longText;
}

function toCafe(place: GooglePlace): Cafe | null {
  try {
    if (!place.location) return null;
    if (place.primaryType && !CAFE_TYPES.has(place.primaryType)) return null;
    const name = place.displayName?.text ?? 'Unnamed cafe';
    if (isFranchise(name)) return null;
    return {
      id: place.id,
      name,
      address: place.formattedAddress ?? '',
      lat: place.location.latitude,
      lng: place.location.longitude,
      rating: place.rating ?? 0,
      reviewCount: place.userRatingCount ?? 0,
      neighborhood:
        componentByType(place, 'sublocality') ?? componentByType(place, 'locality') ?? '',
      region: componentByType(place, 'administrative_area_level_1') ?? '',
    };
  } catch (err) {
    console.warn('[googlePlaces] Skipping malformed place:', err);
    return null;
  }
}

async function callPlacesApi(url: string, body: Record<string, any>): Promise<Cafe[]> {
  const key = getKey();
  if (!key) {
    console.warn('[googlePlaces] EXPO_PUBLIC_GOOGLE_PLACES_KEY is not set — falling back to static cafe list.');
    return [];
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.warn(`[googlePlaces] Request failed (${response.status}):`, errorBody);
      return [];
    }
    const data = await response.json();
    const places: GooglePlace[] = data.places ?? [];
    return places.map(toCafe).filter((c): c is Cafe => c !== null);
  } catch (err) {
    console.warn('[googlePlaces] Request threw:', err);
    return [];
  }
}

// Places API (New) hard-caps circle radius at 50,000m (~31mi) and results at 20
// per request regardless of radius.
const DEFAULT_RADIUS_METERS = 16093; // 10 miles

/** Live cafes near a point, via Places API (New) Nearby Search. */
export async function searchNearbyCafes(
  lat: number,
  lng: number,
  radiusMeters = DEFAULT_RADIUS_METERS
): Promise<Cafe[]> {
  return callPlacesApi('https://places.googleapis.com/v1/places:searchNearby', {
    includedTypes: ['cafe', 'coffee_shop'],
    maxResultCount: 20,
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
    },
  });
}

/** Free-text cafe search (e.g. by name), via Places API (New) Text Search,
 * biased toward a point so results are locally relevant. */
export async function searchCafesByText(query: string, lat: number, lng: number): Promise<Cafe[]> {
  if (!query.trim()) return [];
  return callPlacesApi('https://places.googleapis.com/v1/places:searchText', {
    textQuery: `${query} cafe`,
    includedType: 'cafe',
    maxResultCount: 20,
    locationBias: {
      circle: { center: { latitude: lat, longitude: lng }, radius: DEFAULT_RADIUS_METERS },
    },
  });
}
