import { useEffect } from 'react';
import {
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

export function useStillMotion(): SharedValue<boolean> {
  const reduceMotion = useReducedMotion();
  const still = useSharedValue(reduceMotion);
  useEffect(() => {
    still.value = reduceMotion;
  }, [reduceMotion, still]);
  return still;
}
