import { NativeModule, requireNativeModule } from 'expo-modules-core';
import {
  ExpoScreenTimeModule as ExpoScreenTimeModuleType,
  ScreenTimeAuthorizationStatus,
} from './ExpoScreenTime.types';

declare class ExpoScreenTimeModule extends NativeModule implements ExpoScreenTimeModuleType {
  requestAuthorization(): Promise<boolean>;
  getAuthorizationStatus(): ScreenTimeAuthorizationStatus;
  presentActivityPicker(): Promise<boolean>;
  hasSelection(): boolean;
  applyShield(): Promise<void>;
  removeShield(): Promise<void>;
}

// iOS only — on Android/web this module simply doesn't exist natively.
export default requireNativeModule<ExpoScreenTimeModule>('ExpoScreenTime');
