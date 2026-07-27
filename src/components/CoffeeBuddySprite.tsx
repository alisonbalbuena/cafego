import React from 'react';
import { Image, StyleProp, ImageStyle } from 'react-native';
import { CoffeeFriend } from '../data/coffeeFriends';
import { getBuddyPoseImage } from '../data/buddyPoses';

interface Props {
  friend: CoffeeFriend;
  poseId?: string;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/** The one place the Coffee Buddy is actually drawn. Everything else (photo
 * editor, profile, future feed stickers) renders through here, so swapping a
 * static sprite for an animated one — or adding accessory overlays — is a
 * change to this file only. */
export default function CoffeeBuddySprite({ friend, poseId, size = 120, style }: Props) {
  return (
    <Image
      source={getBuddyPoseImage(friend, poseId)}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
