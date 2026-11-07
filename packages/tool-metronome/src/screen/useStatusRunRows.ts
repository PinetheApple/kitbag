import { useState } from 'react';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { armedRows, type PracticeSettings } from '../logic/statusRows.ts';

export function useStatusRunRows(
  beatPlayed: SharedValue<number>,
  running: boolean,
  settings: PracticeSettings,
): number {
  const [countInOver, setCountInOver] = useState(false);
  const [wasRunning, setWasRunning] = useState(running);
  // A crossing can land after Stop, so each Start reseats this before it commits.
  if (wasRunning !== running) {
    setWasRunning(running);
    setCountInOver(false);
  }
  useAnimatedReaction(
    () => beatPlayed.value !== 0,
    (now, before) => {
      if (now && before !== true) scheduleOnRN(setCountInOver, true);
    },
  );
  const armed = armedRows(settings);
  return countInOver ? armed.played : armed.countingIn;
}
