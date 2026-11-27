import { useTools } from '@kitbag/core-state';
import { useMiniPlayerShown } from '@kitbag/tool-library';
import { usePlayAlongMiniShown } from '@kitbag/tool-sync';

import { TOOL_ID } from '@/home/registry';
import { toolOnTest } from '@/home/toolsOn';

import { useDockSettled } from './useDockSettled';

export function useSongMiniPlayerDocked(): boolean {
  const shown = useMiniPlayerShown();
  const settled = useDockSettled();
  return shown && settled;
}

export function useAnyMiniPlayerDocked(): boolean {
  const song = useMiniPlayerShown();
  const playAlongShown = usePlayAlongMiniShown();
  const playAlongOn = useTools((s) => toolOnTest(s.off)(TOOL_ID.sync));
  const playAlong = playAlongShown && playAlongOn;
  const settled = useDockSettled();
  return (song || playAlong) && settled;
}
