import { KB_COUNT_IN_OFF } from '@kitbag/core-native';
import { useState } from 'react';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { armedRows, type PracticeSettings } from '../logic/statusRows.ts';

export function useStatusRunRows(
  countingIn: SharedValue<number>,
  running: boolean,
  settings: PracticeSettings,
): number {
  const [countInOver, setCountInOver] = useState(running);
  const [wasRunning, setWasRunning] = useState(running);
  // Stop's idle reset reads as a count-in ending, so Start reseats this before it commits.
  if (wasRunning !== running) {
    setWasRunning(running);
    setCountInOver(settings.countIn.bars === KB_COUNT_IN_OFF);
  }
  useAnimatedReaction(
    () => countingIn.value !== 0,
    (now, before) => {
      if (before !== null && now !== before) scheduleOnRN(setCountInOver, !now);
    },
  );
  const armed = armedRows(settings);
  return countInOver ? armed.played : armed.countingIn;
}
