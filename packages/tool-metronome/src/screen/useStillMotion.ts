import { useEffect } from 'react';
import {
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

const HIDDEN = 0;
const SHOWN = 1;

export function trackOpacity(shown: boolean): number {
  'worklet';
  return shown ? SHOWN : HIDDEN;
}

export function useStillMotion(): SharedValue<boolean> {
  const reduceMotion = useReducedMotion();
  const still = useSharedValue(reduceMotion);
  useEffect(() => {
    still.value = reduceMotion;
  }, [reduceMotion, still]);
  return still;
}
