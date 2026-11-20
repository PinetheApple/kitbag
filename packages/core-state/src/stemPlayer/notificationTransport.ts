import type { SongTransportRequest } from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import type { MixerRuntime } from './runtime.ts';
import { countPending } from './songStart.ts';
import { songTransportShown, type SongCardOwner } from './songTransport.ts';
import type { StemPlayerStore } from './store.ts';

type TransportPlayer = Pick<StemPlayerStore, 'togglePlay' | 'seek' | 'status'>;

type CountCardState = Pick<
  StemPlayerStore,
  | 'status'
  | 'countEndFrame'
  | 'title'
  | 'artist'
  | 'durationFrames'
  | 'engineRate'
>;

type RuntimeOf = () => MixerRuntime;

export interface SongTransportRequestOptions {
  readonly get: () => TransportPlayer;
  readonly runtimeOf: RuntimeOf;
  readonly counting: () => boolean;
  readonly stopCount: () => void;
  readonly next?: (session: number) => void;
}

export function songTransportRequests({
  get,
  runtimeOf,
  counting,
  stopCount,
  next,
}: SongTransportRequestOptions): (request: SongTransportRequest) => void {
  const playing = () => runtimeOf().engine.playing();
  return ({ action, frame, shownSession }) => {
    const player = get();
    switch (action) {
      case 'play':
        if (!playing() && !counting()) player.togglePlay();
        return;
      case 'pause':
        if (playing() || counting()) player.togglePlay();
        return;
      case 'stop':
        stopCount();
        return;
      case 'seek':
        if (frame !== null && player.status === 'ready') player.seek(frame);
        return;
      case 'next':
        next?.(shownSession);
        return;
    }
  };
}

export interface SongCardCount {
  readonly stopped: () => void;
}

// The card reads the mixer, which is not playing during a count. A recount
// cancels and restarts in one call, so only a settled change is shown, and a
// stop has already ended the card, so its cancel is not shown.
export function showCountOnSongCard(
  store: Pick<StoreApi<CountCardState>, 'getState' | 'subscribe'>,
  runtimeOf: RuntimeOf,
  counting: () => boolean,
  card: () => SongCardOwner,
): SongCardCount {
  let queued = false;
  let wasCounting = false;
  let stopped = false;
  const flush = () => {
    queued = false;
    const state = store.getState();
    const now = counting();
    if (now) stopped = false;
    if (state.status !== 'ready' || now === wasCounting || stopped) return;
    runtimeOf().commands.songTransportShow({
      ...songTransportShown(state, card(), now),
      playing: now,
    });
  };
  store.subscribe((state, previous) => {
    if (state.countEndFrame === previous.countEndFrame || queued) return;
    queued = true;
    wasCounting = countPending(
      previous.countEndFrame,
      runtimeOf().engine.nowFrame(),
    );
    queueMicrotask(flush);
  });
  return {
    stopped: () => {
      stopped = true;
    },
  };
}
