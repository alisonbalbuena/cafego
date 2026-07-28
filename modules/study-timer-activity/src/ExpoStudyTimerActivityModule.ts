import { NativeModule, requireNativeModule } from 'expo-modules-core';
import { ExpoStudyTimerActivityModule as ExpoStudyTimerActivityModuleType } from './ExpoStudyTimerActivity.types';

declare class ExpoStudyTimerActivityModule
  extends NativeModule
  implements ExpoStudyTimerActivityModuleType
{
  isSupported(): boolean;
  startActivity(
    cafeName: string,
    subject: string,
    phaseLabel: string,
    phaseEndDateMs: number,
    remainingSeconds: number,
    paused: boolean
  ): Promise<boolean>;
  updateActivity(
    subject: string,
    phaseLabel: string,
    phaseEndDateMs: number,
    remainingSeconds: number,
    paused: boolean
  ): Promise<void>;
  endActivity(): Promise<void>;
}

// iOS only — on Android/web this module simply doesn't exist natively.
export default requireNativeModule<ExpoStudyTimerActivityModule>('ExpoStudyTimerActivity');
