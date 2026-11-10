import { useStore } from 'zustand';

import { mixerClick, type MixerClickNotice } from './mixerClick.ts';

export function useMixerClickNotice<T>(
  selector: (state: MixerClickNotice) => T,
): T {
  return useStore(mixerClick.notice, selector);
}
