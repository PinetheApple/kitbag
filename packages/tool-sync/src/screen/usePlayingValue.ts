import { useEffect } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

const PLAYING = 1;
const STOPPED = 0;

export function usePlayingValue(playing: boolean): SharedValue<number> {
  const shown = useSharedValue(playing ? PLAYING : STOPPED);

  useEffect(() => {
    shown.value = playing ? PLAYING : STOPPED;
  }, [playing, shown]);

  return shown;
}
