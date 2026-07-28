import { Platform } from 'react-native';
import { StudyTimerActivityState } from './ExpoStudyTimerActivity.types';

export * from './ExpoStudyTimerActivity.types';

// Only exists in an iOS dev/production build with the widget extension —
// never in Expo Go, and never on Android/web.
let nativeModule: typeof import('./ExpoStudyTimerActivityModule').default | null = null;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nativeModule = require('./ExpoStudyTimerActivityModule').default;
  } catch {
    nativeModule = null;
  }
}

export function isStudyTimerActivitySupported(): boolean {
  if (!nativeModule) return false;
  try {
    return nativeModule.isSupported();
  } catch {
    return false;
  }
}

/** Starts the Lock Screen / Dynamic Island countdown. Call at session start. */
export async function startStudyTimerActivity(
  cafeName: string,
  state: StudyTimerActivityState
): Promise<boolean> {
  if (!nativeModule) return false;
  return nativeModule.startActivity(
    cafeName,
    state.subject,
    state.phaseLabel,
    state.phaseEndDate,
    state.remainingSeconds,
    state.paused
  );
}

/** Updates the running Live Activity. Call on phase change, pause, and resume. */
export async function updateStudyTimerActivity(state: StudyTimerActivityState): Promise<void> {
  if (!nativeModule) return;
  return nativeModule.updateActivity(
    state.subject,
    state.phaseLabel,
    state.phaseEndDate,
    state.remainingSeconds,
    state.paused
  );
}

/** Ends the Live Activity. Call at session end. */
export async function endStudyTimerActivity(): Promise<void> {
  if (!nativeModule) return;
  return nativeModule.endActivity();
}
