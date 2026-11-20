import { MS_PER_SECOND } from '@kitbag/core-db';
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
import { framesToSeconds, secondsToFrames } from '../stemPlayer/time.ts';
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
  readonly countOver: () => void;
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

function lendSoundsForCount(
  store: SongPlayerStoreApi,
  runtimeOf: () => MixerRuntime,
  sounds: CountSounds,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  store.subscribe(({ countEndFrame, engineRate }, previous) => {
    if (countEndFrame === previous.countEndFrame) return;
    clearTimeout(timer);
    if (countEndFrame === null) {
      sounds.countOver();
      return;
    }
    sounds.countArmed();
    const left = countEndFrame - runtimeOf().engine.nowFrame();
    const leftMs = framesToSeconds(left, engineRate) * MS_PER_SECOND;
    timer = setTimeout(sounds.countOver, Math.max(0, Math.ceil(leftMs)));
  });
}

export function songCount(
  context: MixerSessionContext<SongPlayerState>,
  mixer: ReturnType<typeof mixerSession>,
  store: SongPlayerStoreApi,
  sounds: CountSounds,
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
      if (cancelled) playedIn = null;
      return cancelled;
    },
    afterSeek: (frame) => {
      const idle = !runtimeOf().engine.playing() && !start.counting();
      if (idle && frame <= firstBarFrame(get())) playedIn = null;
      start.afterSeek(frame);
    },
  };
  showCountOutsideApp(mixer, store, runtimeOf, count);
  lendSoundsForCount(store, runtimeOf, sounds);
  return count;
}
