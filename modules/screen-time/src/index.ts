import { Platform } from 'react-native';
import { ScreenTimeAuthorizationStatus } from './ExpoScreenTime.types';

export * from './ExpoScreenTime.types';

// This native module only exists in an iOS dev/production build with the
// FamilyControls entitlement — never in Expo Go, and never on Android/web.
// Guard the require so importing this file elsewhere in the app (which also
// runs via `npm run web`) never crashes those bundles.
let nativeModule: typeof import('./ExpoScreenTimeModule').default | null = null;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nativeModule = require('./ExpoScreenTimeModule').default;
  } catch {
    nativeModule = null;
  }
}

/** Whether this build actually has the native Screen Time module linked —
 * check this to decide whether to show the feature in the UI at all. */
export function isScreenTimeSupported(): boolean {
  return nativeModule !== null;
}

export async function requestAuthorization(): Promise<boolean> {
  if (!nativeModule) return false;
  return nativeModule.requestAuthorization();
}

export function getAuthorizationStatus(): ScreenTimeAuthorizationStatus {
  if (!nativeModule) return 'unknown';
  return nativeModule.getAuthorizationStatus();
}

/** Opens Apple's app picker. Resolves true if the user tapped Done, false if
 * they cancelled (or the platform doesn't support it). The app never learns
 * which specific apps were chosen — only whether a selection now exists. */
export async function presentActivityPicker(): Promise<boolean> {
  if (!nativeModule) return false;
  return nativeModule.presentActivityPicker();
}

export function hasSelection(): boolean {
  if (!nativeModule) return false;
  return nativeModule.hasSelection();
}

/** Shields the previously-picked apps — call at study session start. */
export async function applyShield(): Promise<void> {
  if (!nativeModule) return;
  return nativeModule.applyShield();
}

/** Removes the shield — call at study session end/pause. */
export async function removeShield(): Promise<void> {
  if (!nativeModule) return;
  return nativeModule.removeShield();
}
