import { boottimeNowMs, type MediaSessionSnapshot } from '@kitbag/core-native';
import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { progressPlan } from '../logic/miniPlayer.ts';

const SONG_END = 1;

export function usePlayAlongProgress(
  session: MediaSessionSnapshot | undefined,
): SharedValue<number> {
  const progress = useSharedValue(0);

  useEffect(() => {
    const { from, msToEnd } = progressPlan(session, boottimeNowMs());
    progress.value = from;
    if (msToEnd !== undefined)
      progress.value = withTiming(SONG_END, {
        duration: msToEnd,
        easing: Easing.linear,
      });
    return () => {
      cancelAnimation(progress);
    };
  }, [session, progress]);

  return progress;
}
