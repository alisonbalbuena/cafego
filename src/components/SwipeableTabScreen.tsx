import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 300;

interface Props {
  children: React.ReactNode;
}

// Lets the user swipe left/right anywhere on a tab's root screen to move to the
// adjacent tab. Built on react-native-gesture-handler's native Pan gesture
// rather than the JS-thread PanResponder API — activeOffsetX/failOffsetY let
// the native recognizer release the gesture to the screen's ScrollView the
// instant movement reads as vertical, instead of negotiating on the JS thread
// (which is what made vertical scrolling feel sluggish under the old
// PanResponder-based version).
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

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onEnd((event) => {
      const farEnough = Math.abs(event.translationX) > SWIPE_DISTANCE_THRESHOLD;
      const fastEnough = Math.abs(event.velocityX) > SWIPE_VELOCITY_THRESHOLD;
      if (!farEnough && !fastEnough) return;
      switchTab(event.translationX < 0 ? 1 : -1);
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.flex}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
