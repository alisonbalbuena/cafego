import { ImageSourcePropType } from 'react-native';

// Pixel-art icon set replacing plain emoji in a few high-visibility spots.
export const UI_ICONS: Record<string, ImageSourcePropType> = {
  streak: require('../../assets/icons/streak.png'),
  university: require('../../assets/icons/university.png'),
  spending: require('../../assets/icons/spending_budget.png'),
  studyLog: require('../../assets/icons/study_log.png'),
  studyPlans: require('../../assets/icons/study_plans.png'),
  studyInvites: require('../../assets/icons/study_invites.png'),
  leaderboard: require('../../assets/icons/leaderboard.png'),
  mostTimeStudied: require('../../assets/icons/most_time_studied.png'),
  notes: require('../../assets/icons/notes.png'),
  byMyself: require('../../assets/icons/by_myself.png'),
  withFriends: require('../../assets/icons/study_group.png'),
  sessionHistory: require('../../assets/icons/session_history.png'),
  favoriteCafe: require('../../assets/icons/favorite_cafe.png'),
  thisWeek: require('../../assets/icons/this_week.png'),
  camera: require('../../assets/icons/camera.png'),
  backpack: require('../../assets/icons/backpack.png'),
  synced: require('../../assets/icons/synced.png'),
  screenTime: require('../../assets/icons/screen_time.png'),
  collectCoffeeFriends: require('../../assets/icons/collect_coffee_friends.png'),
  findFriends: require('../../assets/icons/find_friends.png'),
};

export const MEDAL_ICONS: ImageSourcePropType[] = [
  require('../../assets/icons/medal_1st.png'),
  require('../../assets/icons/medal_2nd.png'),
  require('../../assets/icons/medal_3rd.png'),
];
