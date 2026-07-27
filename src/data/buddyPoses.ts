import { ImageSourcePropType } from 'react-native';
import { CoffeeFriend, ExpressionKey, getCoffeeFriendImage } from './coffeeFriends';

/** A Coffee Buddy pose. Poses are a layer on top of the character art so the
 * photo editor (and anything else that renders the buddy) never cares where
 * the sprite comes from. Today each pose resolves to one of the character's
 * expression sprites; when dedicated pose art lands in /assets/buddies/
 * (coffee_wave.png, coffee_reading.png, …), swap the `expression` field for a
 * `source: require('../../assets/buddies/…')` and nothing else changes. The
 * same goes for future animation: replace the resolved static image with an
 * animated component inside CoffeeBuddySprite and every caller stays as-is. */
export interface BuddyPose {
  id: string;
  label: string;
  // Placeholder art: which expression sprite stands in for this pose.
  expression: ExpressionKey | 'regular';
}

export const BUDDY_POSES: BuddyPose[] = [
  { id: 'idle', label: 'Chilling', expression: 'regular' },
  { id: 'wave', label: 'Waving hi', expression: 'wink' },
  { id: 'reading', label: 'Deep in a book', expression: 'sunglasses' },
  { id: 'sleeping', label: 'Dozing off', expression: 'sad' },
  { id: 'cheering', label: 'Cheering you on', expression: 'veryhappy' },
  { id: 'drinking', label: 'Sipping away', expression: 'love' },
];

export function getBuddyPose(id?: string): BuddyPose {
  return BUDDY_POSES.find((p) => p.id === id) ?? BUDDY_POSES[0];
}

/** Each check-in picks a surprise pose. */
export function randomBuddyPose(): BuddyPose {
  return BUDDY_POSES[Math.floor(Math.random() * BUDDY_POSES.length)];
}

export function getBuddyPoseImage(friend: CoffeeFriend, poseId?: string): ImageSourcePropType {
  const pose = getBuddyPose(poseId);
  return getCoffeeFriendImage(friend, pose.expression === 'regular' ? undefined : pose.expression);
}
