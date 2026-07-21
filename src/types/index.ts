export type Subject =
  | 'Math'
  | 'Chemistry'
  | 'Biology'
  | 'Physics'
  | 'Computer Science'
  | 'Business'
  | 'Writing'
  | 'Language'
  | 'Other';

export const SUBJECTS: Subject[] = [
  'Math',
  'Chemistry',
  'Biology',
  'Physics',
  'Computer Science',
  'Business',
  'Writing',
  'Language',
  'Other',
];

export interface Cafe {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  neighborhood: string;
  region: string;
}

export type UserRole = 'customer' | 'merchant';

export interface UserProfile {
  uid: string;
  displayName: string;
  firstName: string;
  lastName: string;
  username: string;
  bio?: string;
  email: string;
  createdAt: number;
  role: UserRole;
  loyaltyCode: string;
  merchantCafeId?: string;
  pendingCafeId?: string;
  photoUrl?: string;
  petName?: string;
  petCoins?: number;
  petGrowth?: number;
  petOutfit?: string[];
  allNighterCount?: number;
  community?: string;
  weeklyStreak?: number;
  lastStudyWeekKey?: string;
  streakVisibility?: 'private' | 'friends';
  escapeOverrideCount?: number;
  escapeOverrideMonthKey?: string;
  petBackground?: string;
  petBackgroundsOwned?: string[];
}

export type LoyaltyProgramType = 'points' | 'punchcard';
export type CafeProgramStatus = 'pending' | 'approved';

export interface CafeProgram {
  cafeId: string;
  cafeName: string;
  ownerUid: string;
  status: CafeProgramStatus;
  type: LoyaltyProgramType;
  rewardDescription: string;
  pointsPerDollar?: number;
  pointsForReward?: number;
  punchesRequired?: number;
  expiryDays: number;
  createdAt: number;
  menuImageUrls?: string[];
  onlineMenuUrl?: string;
}

export interface RewardAccount {
  id: string;
  cafeId: string;
  cafeName: string;
  uid: string;
  displayName: string;
  points: number;
  punches: number;
  rewardEarnedAt?: number;
  rewardExpiresAt?: number;
  updatedAt: number;
}

export interface CafeAnnouncement {
  id: string;
  cafeId: string;
  cafeName: string;
  message: string;
  createdAt: number;
}

export interface MenuItem {
  id: string;
  cafeId: string;
  name: string;
  description: string;
  price: number;
  createdAt: number;
}

export interface CafeReview {
  id: string;
  cafeId: string;
  uid: string;
  displayName: string;
  ambienceRating: number;
  drinksRating: number;
  pricesRating: number;
  environmentRating: number;
  comment: string;
  createdAt: number;
  photoUrls?: string[];
}

export type FriendRequestStatus = 'pending' | 'accepted';

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromDisplayName: string;
  fromUsername?: string;
  toUid: string;
  toDisplayName: string;
  toUsername?: string;
  status: FriendRequestStatus;
  createdAt: number;
}

// 'public' is a legacy wire value kept for backward compatibility with existing
// session docs — it means "visible to friends" (same as the new 'friends' label).
export type SessionVisibility = 'private' | 'public' | 'community' | 'everyone';

export const VISIBILITY_LEVELS: { value: SessionVisibility; label: string; emoji: string }[] = [
  { value: 'private', label: 'Just me', emoji: '🔒' },
  { value: 'public', label: 'Friends', emoji: '👥' },
  { value: 'community', label: 'My community', emoji: '🏫' },
  { value: 'everyone', label: 'Everyone', emoji: '🌍' },
];

export function visibilityMeta(visibility?: SessionVisibility) {
  return VISIBILITY_LEVELS.find((v) => v.value === visibility) ?? VISIBILITY_LEVELS[1];
}

export type StudyIntensity = 'chilling' | 'working' | 'locked_in';

export const STUDY_INTENSITIES: { value: StudyIntensity; label: string; emoji: string }[] = [
  { value: 'chilling', label: 'Chilling', emoji: '😌' },
  { value: 'working', label: 'Attempting to do work', emoji: '📝' },
  { value: 'locked_in', label: 'MEGA locked in', emoji: '🔒' },
];

export function intensityMeta(intensity?: StudyIntensity) {
  return STUDY_INTENSITIES.find((i) => i.value === intensity) ?? STUDY_INTENSITIES[1];
}

export type StudyMode = 'solo' | 'group';

export interface StudyBuddy {
  uid: string;
  displayName: string;
}

export type BusynessLevel = 'open' | 'moderate' | 'busy';

export const BUSYNESS_LEVELS: { value: BusynessLevel; label: string; emoji: string }[] = [
  { value: 'open', label: 'Very open', emoji: '🟢' },
  { value: 'moderate', label: 'Moderately busy', emoji: '🟡' },
  { value: 'busy', label: 'Extremely busy', emoji: '🔴' },
];

export function busynessMeta(level?: BusynessLevel) {
  return BUSYNESS_LEVELS.find((b) => b.value === level);
}

export type DistractionMode = 'allowed' | 'blocked';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  photoUrl?: string;
}

export interface SubjectSegment {
  subject: Subject;
  startedAt: number;
  endedAt: number | null;
}

export interface StudySession {
  id: string;
  uid: string;
  displayName: string;
  cafeId: string;
  cafeName: string;
  subject: Subject;
  startedAt: number;
  endedAt: number | null;
  visibility?: SessionVisibility;
  intensity?: StudyIntensity;
  amountSpent?: number;
  studyMode?: StudyMode;
  withFriends?: StudyBuddy[];
  distractionMode?: DistractionMode;
  checklist?: ChecklistItem[];
  myCode?: string;
  locked?: boolean;
  subjectLog?: SubjectSegment[];
  archived?: boolean;
  busynessReport?: BusynessLevel;
  paused?: boolean;
  pausedAt?: number | null;
  pausedMs?: number;
  allNighter?: boolean;
  community?: string;
}

export function isSessionPublic(session: StudySession): boolean {
  return session.visibility !== 'private';
}

export function isSessionVisibleToCommunity(session: StudySession): boolean {
  return session.visibility === 'community' || session.visibility === 'everyone';
}

/** Per-subject time segments for a session, falling back to a single segment
 * spanning the whole session for sessions created before subject-switching existed. */
export function getSessionSubjectSegments(session: StudySession): SubjectSegment[] {
  if (session.subjectLog && session.subjectLog.length > 0) return session.subjectLog;
  return [{ subject: session.subject, startedAt: session.startedAt, endedAt: session.endedAt }];
}

export interface StudyNote {
  uid: string;
  displayName: string;
  text: string;
  createdAt: number;
}

export const NOTE_TTL_MS = 24 * 60 * 60 * 1000;

export interface Nudge {
  id: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  createdAt: number;
}
