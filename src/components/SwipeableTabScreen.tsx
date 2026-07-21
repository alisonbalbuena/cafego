import React, { useRef } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const DIRECTION_LOCK_RATIO = 1.5;

interface Props {
  children: React.ReactNode;
}

// Lets the user swipe left/right anywhere on a tab's root screen to move to the
// adjacent tab. Uses the plain PanResponder API (no gesture-handler/reanimated
// dependency) and only claims the gesture once movement is clearly horizontal,
// so vertical scrolling inside the screen keeps working normally.
// Screens can sit directly on the tab bar (e.g. Study) or be nested one level
// down inside a per-tab stack (e.g. Home -> HomeStack -> HomeMain), so walk up
// until we find the actual tab navigator rather than assuming a fixed depth.
function findTabNavigation(nav: any): any {
  let current = nav;
  while (current) {
    if (current.getState?.()?.type === 'tab') return current;
    current = current.getParent?.();
  }
  return null;
}

export default function SwipeableTabScreen({ children }: Props) {
  const navigation = useNavigation();

  const switchTab = (direction: 1 | -1) => {
    const tabNav = findTabNavigation(navigation);
    if (!tabNav) return;
    const state = tabNav.getState();
    const nextIndex = state.index + direction;
    if (nextIndex < 0 || nextIndex >= state.routeNames.length) return;
    tabNav.navigate(state.routeNames[nextIndex]);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * DIRECTION_LOCK_RATIO,
      onPanResponderRelease: (_, gesture) => {
        const farEnough = Math.abs(gesture.dx) > SWIPE_DISTANCE_THRESHOLD;
        const fastEnough = Math.abs(gesture.vx) > SWIPE_VELOCITY_THRESHOLD;
        if (!farEnough && !fastEnough) return;
        switchTab(gesture.dx < 0 ? 1 : -1);
      },
    })
  ).current;

  return (
    <View style={styles.flex} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
