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

export interface CountSounds {
  readonly countArmed: () => void;
  readonly countDropped: () => void;
}

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
  next: (session: number) => void,
): void {
  mixer.onScrubSeek(start.afterSeek);
  mixer.onClickReleased(start.endCountNow);
  const card = showCountOnSongCard(
    store,
    runtimeOf,
    start.counting,
    mixer.card,
  );
  mixer.onSongTransport(
    songTransportRequests({
      get: store.getState,
      runtimeOf,
      counting: start.counting,
      stopCount: () => {
        card.stopped();
        start.stop();
      },
      next,
    }),
  );
}

function lendSoundsForCount(
  store: SongPlayerStoreApi,
  sounds: CountSounds,
): void {
  store.subscribe(({ countEndFrame }, previous) => {
    if (countEndFrame === previous.countEndFrame || countEndFrame === null)
      return;
    sounds.countArmed();
  });
}

export function songCount(
  context: MixerSessionContext<SongPlayerState>,
  mixer: ReturnType<typeof mixerSession>,
  store: SongPlayerStoreApi,
  sounds: CountSounds,
  next: (session: number) => void,
): SongStart {
  const { get, runtimeOf, session } = context;
  const start = songStart({
    ...context,
    runtimeOf: () => ({
      ...runtimeOf(),
      countInBars: () => get().clickSettings.countInBars,
    }),
    releaseClick: () => releaseClick(context),
  });
  let playedIn: number | null = null;
  const atTop = (head: number) =>
    playedIn !== session() && head <= firstBarFrame(get());
  const count: SongStart = {
    ...start,
    play: (head) => {
      const fromTop = atTop(head);
      playedIn = session();
      if (fromTop) start.play(head);
      else runtimeOf().commands.mixerPlay();
    },
    cancel: () => {
      const cancelled = start.cancel();
      if (!cancelled) return false;
      playedIn = null;
      sounds.countDropped();
      return true;
    },
    stop: () => {
      const lent = !get().click;
      const stopped = start.stop();
      if (stopped && lent) sounds.countDropped();
      return stopped;
    },
    afterSeek: (frame) => {
      const idle = !runtimeOf().engine.playing() && !start.counting();
      if (idle && frame <= firstBarFrame(get())) playedIn = null;
      start.afterSeek(frame);
    },
  };
  showCountOutsideApp(mixer, store, runtimeOf, count, next);
  lendSoundsForCount(store, sounds);
  return count;
}
