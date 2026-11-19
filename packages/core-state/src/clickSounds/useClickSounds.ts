import { useStore } from 'zustand';

import { clickSoundStore, type ClickSoundStore } from './store.ts';

export function useClickSounds<T>(selector: (state: ClickSoundStore) => T): T {
  return useStore(clickSoundStore, selector);
}
