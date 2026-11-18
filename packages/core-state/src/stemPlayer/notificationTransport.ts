import type { SongTransportRequest } from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import type { MixerRuntime } from './runtime.ts';
import { songTransportShown } from './songTransport.ts';
import type { StemPlayerStore } from './store.ts';

type RuntimeOf = () => MixerRuntime;

export interface SongTransportRequestOptions {
  readonly get: () => StemPlayerStore;
  readonly runtimeOf: RuntimeOf;
  readonly counting: () => boolean;
  readonly stopCount: () => void;
}

export function songTransportRequests({
  get,
  runtimeOf,
  counting,
  stopCount,
}: SongTransportRequestOptions): (request: SongTransportRequest) => void {
  const playing = () => runtimeOf().engine.playing();
  return ({ action, frame }) => {
    const player = get();
    switch (action) {
      case 'play':
        if (!playing()) player.togglePlay();
        return;
      case 'pause':
        if (playing() || counting()) player.togglePlay();
        return;
      case 'stop':
        stopCount();
        return;
      case 'seek':
        if (frame !== null) player.seek(frame);
        return;
    }
  };
}

// The card reads the mixer, which is not playing during a count. A recount
// cancels and restarts in one call, so only a settled change is shown.
export function showCountOnSongCard(
  store: StoreApi<StemPlayerStore>,
  runtimeOf: RuntimeOf,
): void {
  let queued = false;
  let wasCounting = false;
  const flush = () => {
    queued = false;
    const state = store.getState();
    const counting = state.countEndFrame !== null;
    if (state.status !== 'ready' || counting === wasCounting) return;
    runtimeOf().commands.songTransportShow({
      ...songTransportShown(state),
      playing: counting,
    });
  };
  store.subscribe((state, previous) => {
    if (state.countEndFrame === previous.countEndFrame || queued) return;
    queued = true;
    wasCounting = previous.countEndFrame !== null;
    queueMicrotask(flush);
  });
}
