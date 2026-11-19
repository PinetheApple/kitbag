import { useSongPlayer } from '@kitbag/core-state';
import { useCallback, useEffect, useRef } from 'react';

export function useLeaveOnStop(focused: boolean, onBack: () => void) {
  const stopped = useSongPlayer((s) => s.status === 'idle');
  const seenOpen = useRef(false);
  const left = useRef(false);
  const leave = useCallback(() => {
    left.current = true;
    onBack();
  }, [onBack]);
  useEffect(() => {
    if (!focused) {
      seenOpen.current = false;
      left.current = false;
      return;
    }
    if (!stopped) seenOpen.current = true;
    else if (seenOpen.current && !left.current) leave();
  }, [focused, stopped, leave]);
  return leave;
}
