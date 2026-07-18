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
  email: string;
  createdAt: number;
  role: UserRole;
  loyaltyCode: string;
  merchantCafeId?: string;
}

export type LoyaltyProgramType = 'points' | 'punchcard';

export interface CafeProgram {
  cafeId: string;
  cafeName: string;
  ownerUid: string;
  type: LoyaltyProgramType;
  rewardDescription: string;
  pointsPerDollar?: number;
  pointsForReward?: number;
  punchesRequired?: number;
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
  toUid: string;
  toDisplayName: string;
  status: FriendRequestStatus;
  createdAt: number;
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
}
