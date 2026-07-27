export type ScreenTimeAuthorizationStatus = 'notDetermined' | 'denied' | 'approved' | 'unknown';

export interface ExpoScreenTimeModule {
  /** Prompts the system Screen Time consent sheet. Resolves true if granted. */
  requestAuthorization(): Promise<boolean>;
  /** Current authorization state — check this before calling anything else. */
  getAuthorizationStatus(): ScreenTimeAuthorizationStatus;
  /** Presents Apple's FamilyActivityPicker modally so the user can choose
   * which apps/categories to shield. Resolves true if they tapped Done,
   * false if they cancelled. The app never learns which apps were chosen —
   * only whether a selection now exists (see hasSelection). */
  presentActivityPicker(): Promise<boolean>;
  /** Whether the user has completed the picker at least once. */
  hasSelection(): boolean;
  /** Shields the previously-picked apps/categories — call at session start. */
  applyShield(): Promise<void>;
  /** Removes the shield — call at session end/pause. */
  removeShield(): Promise<void>;
}
