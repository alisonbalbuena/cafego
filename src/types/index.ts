import { ImageSourcePropType } from 'react-native';

// Free text — whatever a student is studying (a class, course code, major, etc).
export type Subject = string;

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
  petCoins?: number;
  unlockedCoffeeFriends?: string[];
  activeCoffeeFriend?: string;
  buddyName?: string;
  coffeeNameChangesUsed?: number;
  unlockedExpressions?: string[];
  activeExpression?: string;
  allNighterCount?: number;
  community?: string;
  weeklyStreak?: number;
  lastStudyWeekKey?: string;
  streakVisibility?: 'private' | 'friends';
  petBackground?: string;
  petBackgroundsOwned?: string[];
  budgetAmount?: number;
  budgetPeriod?: 'weekly' | 'monthly';
  syncExitCount?: number;
  syncExitMonthKey?: string;
  availableUntil?: number;
  calendarLogging?: boolean;
  screenTimeShieldEnabled?: boolean;
  syncedSessionCount?: number;
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

/** A menu photo contributed by any user (distinct from the merchant's own
 * menuImageUrls on CafeProgram, which only the cafe owner can manage). */
export interface MenuPhoto {
  id: string;
  cafeId: string;
  uid: string;
  displayName: string;
  url: string;
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

/** A group (or solo) accountability plan: everyone commits to a daily minimum
 * for a fixed span, self-reports via their own study sessions (any subject
 * counts — no strict subject matching), and either earns/loses coins per day
 * or unlocks a group-wide reward if nobody misses more than the threshold. */
export interface StudyPlan {
  id: string;
  name: string;
  subject: string;
  createdBy: string;
  memberUids: string[];
  memberNames: Record<string, string>;
  durationDays: number;
  startDateKey: string;
  endDateKey: string;
  dailyMinMinutes: number;
  missThreshold: 1 | 2;
  dailyBonusCoins: number;
  penaltyCoins: number;
  groupRewardCoins: number;
  createdAt: number;
  // Per-member bookkeeping — each member only ever writes their own uid's
  // entries (self-evaluated on their own device; there's no backend to do it
  // centrally), but any member can update the shared doc to record it.
  missedDays?: Record<string, number>;
  penalizedUids?: string[];
  processedDays?: Record<string, string[]>;
  groupRewardClaimedBy?: string[];
}

export type StudyInviteStatus = 'pending' | 'accepted' | 'declined';

/** A scheduled "study with me" invite — a real commitment made ahead of time,
 * distinct from starting/syncing a session in the moment. Accepting adds it
 * to the device calendar (which for most people is already synced to Google
 * Calendar) rather than syncing via Google's API directly. */
export interface StudyInvite {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  scheduledAt: number;
  durationMin: number;
  subject?: string;
  status: StudyInviteStatus;
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

export type StudyMethod =
  | 'none'
  | 'custom'
  | 'pomodoro'
  | 'fiftyTwoSeventeen'
  | 'ultradian90'
  | 'timeboxing';

export interface StudyMethodConfig {
  value: StudyMethod;
  label: string;
  emoji: string;
  icon?: ImageSourcePropType;
  description: string;
  workMin: number | null;
  breakMin: number | null;
  roundsBeforeLongBreak?: number;
  longBreakMin?: number;
}

const NO_METHOD: StudyMethodConfig = {
  value: 'none',
  label: 'None',
  emoji: '⏱️',
  description: 'No structured timer.',
  workMin: null,
  breakMin: null,
};

export const STUDY_METHODS: StudyMethodConfig[] = [
  {
    value: 'custom',
    label: 'Freeform',
    emoji: '🎛️',
    icon: require('../../assets/icons/freeform.png'),
    description: 'Set your own total session length, work intervals, and break schedule.',
    workMin: null,
    breakMin: null,
  },
  {
    value: 'pomodoro',
    label: 'Pomodoro',
    emoji: '🍅',
    icon: require('../../assets/icons/pomodoro.png'),
    description: '25 min focus, 5 min break. Long break after 4 rounds.',
    workMin: 25,
    breakMin: 5,
    roundsBeforeLongBreak: 4,
    longBreakMin: 20,
  },
  {
    value: 'fiftyTwoSeventeen',
    label: '52/17',
    emoji: '⏳',
    icon: require('../../assets/icons/fifty_two_seventeen.png'),
    description: '52 min focus, 17 min break — matches natural attention rhythms for some people.',
    workMin: 52,
    breakMin: 17,
  },
  {
    value: 'ultradian90',
    label: '90-min focus blocks',
    emoji: '🧠',
    icon: require('../../assets/icons/ninety_min_focus.png'),
    description: '90 min focus, then a real break — follows your natural ~90-min alertness cycle.',
    workMin: 90,
    breakMin: 18,
  },
  {
    value: 'timeboxing',
    label: 'Timeboxing',
    emoji: '📦',
    icon: require('../../assets/icons/timeboxing.png'),
    description: 'Set a hard time limit for this task — no extensions, forces prioritization.',
    workMin: null,
    breakMin: null,
  },
];

export function studyMethodMeta(method?: StudyMethod): StudyMethodConfig {
  return STUDY_METHODS.find((m) => m.value === method) ?? NO_METHOD;
}

export type StudyMethodPhase = 'work' | 'break' | 'longBreak' | 'done';

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
  cafeLat?: number;
  cafeLng?: number;
  subject: Subject;
  startedAt: number;
  endedAt: number | null;
  visibility?: SessionVisibility;
  intensity?: StudyIntensity;
  amountSpent?: number;
  studyMode?: StudyMode;
  withFriends?: StudyBuddy[];
  subjectLog?: SubjectSegment[];
  archived?: boolean;
  busynessReport?: BusynessLevel;
  paused?: boolean;
  pausedAt?: number | null;
  pausedMs?: number;
  allNighter?: boolean;
  community?: string;
  studyMethod?: StudyMethod;
  methodWorkMin?: number;
  methodBreakMin?: number;
  methodTotalMin?: number;
  methodBreakCount?: number;
  methodPhase?: StudyMethodPhase;
  methodPhaseStartedAt?: number;
  methodRound?: number;
  syncPartnerUid?: string;
  syncReadyToUnlock?: boolean;
  syncExitReason?: string;
  checkInPhotoUrl?: string;
  checkInPhotoWithBuddyUrl?: string;
  buddyPoseId?: string;
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

export type BuddyPostSource = 'adventure' | 'checkin';

/** A shared photo of a user's Coffee Buddy — posted either from the "take
 * your buddy on an adventure" button (PetScreen) or from a check-in photo
 * (CheckInScreen). Shows up in the buddy adventure feed on Home and on the
 * poster's own profile. */
export interface BuddyPost {
  id: string;
  uid: string;
  displayName: string;
  buddyName: string;
  imageUrl: string;
  poseId?: string;
  cafeName?: string;
  location?: string;
  caption?: string;
  source: BuddyPostSource;
  createdAt: number;
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
