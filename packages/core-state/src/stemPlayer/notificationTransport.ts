import type { SongTransportRequest } from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import type { MixerRuntime } from './runtime.ts';
import { countPending } from './songStart.ts';
import { songTransportShown } from './songTransport.ts';
import type { StemPlayerStore } from './store.ts';

type RuntimeOf = () => MixerRuntime;

export function songTransportRequests(
  get: () => StemPlayerStore,
  runtimeOf: RuntimeOf,
): (request: SongTransportRequest) => void {
  const playing = () => runtimeOf().engine.playing();
  const counting = () =>
    countPending(get().countEndFrame, runtimeOf().engine.nowFrame());
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
        player.close();
        return;
      case 'seek':
        if (frame !== null) player.seek(frame);
        return;
    }
  };
}

// The card reads the mixer, which is not playing during a count, so the count's
// start and cancel are told to it.
export function showCountOnSongCard(
  store: StoreApi<StemPlayerStore>,
  runtimeOf: RuntimeOf,
): void {
  store.subscribe((state, previous) => {
    if (state.countEndFrame === previous.countEndFrame) return;
    if (state.status !== 'ready') return;
    runtimeOf().commands.songTransportShow({
      ...songTransportShown(state),
      playing: state.countEndFrame !== null,
    });
  });
}
