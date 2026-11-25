import { useLiveSongPlayer } from '@kitbag/core-state';
import { useCallback, useEffect, useMemo, useRef } from 'react';

export function useLeaveOnStop(
  focused: boolean,
  onBack: () => void,
  songId: number,
) {
  const idle = useLiveSongPlayer((s) => s.status === 'idle');
  const seenOpen = useRef(false);
  const left = useRef(false);
  const shownSong = useRef(songId);
  const leave = useCallback(() => {
    left.current = true;
    onBack();
  }, [onBack]);
  const markLeft = useCallback(() => {
    left.current = true;
  }, []);
  useEffect(() => {
    if (!focused || shownSong.current !== songId) {
      shownSong.current = songId;
      seenOpen.current = false;
      left.current = false;
    }
    if (!focused) return;
    if (!idle) seenOpen.current = true;
    else if (seenOpen.current && !left.current) leave();
  }, [focused, idle, leave, songId]);
  return useMemo(() => ({ leave, markLeft }), [leave, markLeft]);
}
