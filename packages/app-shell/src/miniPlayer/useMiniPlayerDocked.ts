import { useMiniPlayerShown } from '@kitbag/tool-library';

import { useDockSettled } from './useDockSettled';

export function useMiniPlayerDocked(): boolean {
  const shown = useMiniPlayerShown();
  const settled = useDockSettled();
  return shown && settled;
}
