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

export type SessionVisibility = 'public' | 'private';

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

export type DistractionMode = 'allowed' | 'blocked';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  photoUrl?: string;
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
}

export function isSessionPublic(session: StudySession): boolean {
  return session.visibility !== 'private';
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
