import { KB_DEFAULT_SOUNDS } from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import { libraryStore } from '../library/store.ts';
import type { LibraryStore } from '../library/store.ts';
import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';

export async function releaseRemovedSound(
  soundId: number,
  metronome: StoreApi<MetronomeStore> = metronomeStore,
  library: StoreApi<Pick<LibraryStore, 'refresh'>> = libraryStore,
): Promise<void> {
  const { sounds, setSounds } = metronome.getState();
  if (sounds.normal === soundId || sounds.accent === soundId)
    setSounds(
      sounds.normal === soundId ? KB_DEFAULT_SOUNDS.normal : sounds.normal,
      sounds.accent === soundId ? KB_DEFAULT_SOUNDS.accent : sounds.accent,
    );
  await library.getState().refresh();
}
