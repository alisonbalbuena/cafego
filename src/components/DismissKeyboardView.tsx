import React from 'react';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';

/** Tapping anywhere that isn't itself a focused input/button dismisses the
 * keyboard — wrapped once around the whole app (App.tsx) so every screen
 * gets this for free instead of each screen needing its own handling. */
export default function DismissKeyboardView({ children }: { children: React.ReactNode }) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>{children}</View>
    </TouchableWithoutFeedback>
  );
}
