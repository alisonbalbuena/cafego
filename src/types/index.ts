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

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
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
