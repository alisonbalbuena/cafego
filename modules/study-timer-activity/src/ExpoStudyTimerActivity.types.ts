export interface StudyTimerActivityState {
  subject: string;
  /** "Focus", "Break", "Long break", or "Done" */
  phaseLabel: string;
  /** Epoch ms when the current phase ends. */
  phaseEndDate: number;
  /** Snapshot used only while paused (a live countdown wouldn't make sense
   * against a frozen end date). */
  remainingSeconds: number;
  paused: boolean;
}

export interface ExpoStudyTimerActivityModule {
  /** Whether Live Activities are supported and enabled on this device. */
  isSupported(): boolean;
  /** Starts a new Live Activity, ending any previous one first. Resolves
   * false if Live Activities are disabled/unsupported. */
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
