import type { StoreApi } from 'zustand/vanilla';

import { usableDownbeats } from '../stemPlayer/bars.ts';
import { releaseClick } from '../stemPlayer/clickActions.ts';
import type {
  mixerSession,
  MixerSessionContext,
} from '../stemPlayer/mixerSession.ts';
import {
  showCountOnSongCard,
  songTransportRequests,
} from '../stemPlayer/notificationTransport.ts';
import type { MixerRuntime } from '../stemPlayer/runtime.ts';
import {
  countPending,
  songStart,
  type SongStart,
} from '../stemPlayer/songStart.ts';
import { secondsToFrames } from '../stemPlayer/time.ts';
import type { SongPlayerActions } from './actions.ts';
import type { SongPlayerState } from './state.ts';

type CountState = Pick<
  SongPlayerState,
  'beats' | 'downbeatIndices' | 'engineRate' | 'countEndFrame'
>;

type SongPlayerStoreApi = Pick<
  StoreApi<SongPlayerState & Pick<SongPlayerActions, 'togglePlay' | 'seek'>>,
  'getState' | 'subscribe'
>;

export function countingNow(
  get: () => Pick<SongPlayerState, 'countEndFrame'>,
  runtimeOf: () => MixerRuntime,
): () => boolean {
  return () => countPending(get().countEndFrame, runtimeOf().engine.nowFrame());
}

function firstBarFrame({
  beats,
  downbeatIndices,
  engineRate,
}: CountState): number {
  const first = usableDownbeats(downbeatIndices, beats.length)[0] ?? 0;
  return secondsToFrames(beats[first] ?? 0, engineRate);
}

function showCountOutsideApp(
  mixer: ReturnType<typeof mixerSession>,
  store: SongPlayerStoreApi,
  runtimeOf: () => MixerRuntime,
  start: SongStart,
): void {
  mixer.onScrubSeek(start.afterSeek);
  mixer.onClickReleased(start.endCountNow);
  const card = showCountOnSongCard(store, runtimeOf, start.counting);
  mixer.onSongTransport(
    songTransportRequests({
      get: store.getState,
      runtimeOf,
      counting: start.counting,
      stopCount: () => {
        card.stopped();
        start.stop();
      },
    }),
  );
}

export function songCount(
  context: MixerSessionContext<SongPlayerState>,
  mixer: ReturnType<typeof mixerSession>,
  store: SongPlayerStoreApi,
): SongStart {
  const { get, runtimeOf } = context;
  const start = songStart({
    ...context,
    runtimeOf: () => ({
      ...runtimeOf(),
      countInBars: () => get().clickSettings.countInBars,
    }),
    releaseClick: () => releaseClick(context),
  });
  showCountOutsideApp(mixer, store, runtimeOf, start);
  return {
    ...start,
    play: (head) => {
      if (head <= firstBarFrame(get())) start.play(head);
      else runtimeOf().commands.mixerPlay();
    },
  };
}
