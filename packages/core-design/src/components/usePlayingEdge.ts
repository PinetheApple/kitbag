import { useState } from 'react';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function usePlayingEdge(
  playing: SharedValue<number>,
  initial: boolean,
): boolean {
  const [isPlaying, setIsPlaying] = useState(initial);
  useAnimatedReaction(
    () => playing.value !== 0,
    (now, before) => {
      if (now !== before) scheduleOnRN(setIsPlaying, now);
    },
  );
  return isPlaying;
}
