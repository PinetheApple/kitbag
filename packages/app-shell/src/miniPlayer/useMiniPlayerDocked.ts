import { useMiniPlayerShown } from '@kitbag/tool-library';
import { usePlayAlongMiniShown } from '@kitbag/tool-sync';

import { useDockSettled } from './useDockSettled';

export function useSongMiniPlayerDocked(): boolean {
  const shown = useMiniPlayerShown();
  const settled = useDockSettled();
  return shown && settled;
}

export function useMiniPlayerDocked(): boolean {
  const song = useMiniPlayerShown();
  const playAlong = usePlayAlongMiniShown();
  const settled = useDockSettled();
  return (song || playAlong) && settled;
}
