import { useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export function useDrillTap() {
  const [open, setOpen] = useState(false);
  const tap = Gesture.Tap().onEnd(() => {
    'worklet';
    runOnJS(setOpen)(true);
  });
  return { open, tap };
}
