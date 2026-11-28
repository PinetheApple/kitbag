import { TOOL_ID } from '@/home/registry';
import { useToolOn } from '@/home/toolsOn';
import { useMiniPlayerShown } from '@/listening/MiniPlayer';
import { useCompiledTools } from '@/tools/compiledToolsContext';

import { useDockSettled } from './useDockSettled';

export function useSongMiniPlayerDocked(): boolean {
  const shown = useMiniPlayerShown();
  const settled = useDockSettled();
  return shown && settled;
}

export function useAnyMiniPlayerDocked(): boolean {
  const song = useMiniPlayerShown();
  const playAlongShown = useCompiledTools().sync.miniPlayer.useShown();
  const playAlongOn = useToolOn()(TOOL_ID.sync);
  const playAlong = playAlongShown && playAlongOn;
  const settled = useDockSettled();
  return (song || playAlong) && settled;
}
