import {
  acquireEngineHold,
  KB_MIXER_UNITY_RATE,
  KB_RESULT,
  type SongTransportRequest,
} from '@kitbag/core-native';

import type { MixerClick, MixerClickSource } from './mixerClick.ts';
import { stopClick, turnClickOff, type ClickSlice } from './clickActions.ts';
import { debounce } from './debounce.ts';
import type { MixerClaim } from './mixerClaim.ts';
import { createPendingClick } from './pendingClick.ts';
import type { MixerRuntime, StemPlayerCommands } from './runtime.ts';
import type { StemPlayerState } from './store.ts';

export interface MixerSessionContext<Slice> {
  readonly set: (change: Partial<Slice>) => void;
  readonly get: () => Slice;
  readonly runtimeOf: () => MixerRuntime;
  readonly session: () => number;
}

type SessionSlice = ClickSlice & Pick<StemPlayerState, 'loop' | 'title'>;

export interface MixerHold {
  readonly release: () => void;
  readonly live: () => boolean;
}

export interface MixerSessionOptions extends Omit<
  MixerSessionContext<SessionSlice>,
  'session'
> {
  readonly scrubSeekDelayMs: number;
  readonly claim: MixerClaim;
  readonly mixerClick: MixerClick;
  readonly isOpen: () => boolean;
  readonly beforeTeardown?: () => void;
  readonly teardownTracks: () => void;
  readonly counting?: () => boolean;
  readonly resetState: () => void;
}

export function mixerSession({
  set,
  get,
  runtimeOf,
  scrubSeekDelayMs,
  claim,
  mixerClick,
  isOpen,
  beforeTeardown,
  teardownTracks,
  counting = () => false,
  resetState,
}: MixerSessionOptions) {
  let session = 0;
  let releaseEngine: (() => void) | null = null;
  let songStopSubscription: ReturnType<
    StemPlayerCommands['onSongStopped']
  > | null = null;
  let songTransportSubscription: ReturnType<
    StemPlayerCommands['onSongTransport']
  > | null = null;
  let songTransportListener: ((request: SongTransportRequest) => void) | null =
    null;
  let afterScrubSeek: ((frame: number) => void) | null = null;
  let afterClickRelease: (() => void) | null = null;
  let songStopped = () => {
    turnClickOff({ set, get, runtimeOf });
  };
  const scrubSeek = debounce((frame: number) => {
    runtimeOf().commands.mixerSeek(frame);
    afterScrubSeek?.(frame);
  }, scrubSeekDelayMs);
  const live = (opened: number) => opened === session;
  const pendingClick = createPendingClick();
  const clickSource: MixerClickSource = {
    running: () => get().click || pendingClick.pending() || counting(),
    title: () => get().title,
    turnOff: () => {
      pendingClick.cancel();
      turnClickOff({ set, get, runtimeOf });
      afterClickRelease?.();
    },
  };

  const teardown = () => {
    beforeTeardown?.();
    const runtime = runtimeOf();
    const { commands } = runtime;
    const { click, loop } = get();
    scrubSeek.cancel();
    const countPending = counting();
    if (click) stopClick(runtime);
    commands.songTransportHide();
    if (countPending) commands.songStop();
    else commands.mixerStop();
    if (loop.kind === 'on') void commands.mixerClearLoop().catch(() => null);
    teardownTracks();
  };

  // A second close, from a screen whose session was already displaced, must
  // not stop whatever displaced it.
  const close = () => {
    if (!isOpen()) return;
    claim.release(close);
    mixerClick.detach(clickSource);
    pendingClick.cancel();
    session++;
    teardown();
    resetState();
    releaseEngine?.();
    releaseEngine = null;
    songStopSubscription?.remove();
    songStopSubscription = null;
    songTransportSubscription?.remove();
    songTransportSubscription = null;
  };

  const awaitReset = async (opened: number, reset: Promise<number>) => {
    const result = await reset;
    if (!live(opened)) return false;
    if (result !== KB_RESULT.KB_OK) {
      set({ status: 'failed' });
      return false;
    }
    return true;
  };

  // A rate the engine refuses falls back to unity rather than failing the song.
  const clearSessionLeftovers = async (
    opened: number,
    rate: number = KB_MIXER_UNITY_RATE,
  ): Promise<number | null> => {
    await claim.settled();
    const { commands } = runtimeOf();
    // A loop a failed clear left behind would otherwise play in this song.
    await commands.mixerClearLoop().catch(() => null);
    // The rate is engine-wide and outlives stop and unload.
    const current = await commands.mixerRate();
    if (!live(opened)) return null;
    if (current === rate) return rate;
    if (rate !== KB_MIXER_UNITY_RATE) {
      const result = await commands.mixerSetRate(rate);
      if (!live(opened)) return null;
      if (result === KB_RESULT.KB_OK) return rate;
      console.warn('[kitbag] stored speed refused, playing at unity', result);
    }
    const reset = commands.mixerSetRate(KB_MIXER_UNITY_RATE);
    return (await awaitReset(opened, reset)) ? KB_MIXER_UNITY_RATE : null;
  };

  return {
    scrubSeek,
    onScrubSeek: (listener: (frame: number) => void) => {
      afterScrubSeek = listener;
    },
    onClickReleased: (listener: () => void) => {
      afterClickRelease = listener;
    },
    onSongTransport: (listener: (request: SongTransportRequest) => void) => {
      songTransportListener = listener;
    },
    onSongStopped: (listener: () => void) => {
      songStopped = listener;
    },
    live,
    close,
    current: () => session,
    pendingClick,
    hold: (opened: number): MixerHold => ({
      release: () => {
        if (live(opened)) close();
      },
      live: () => live(opened),
    }),
    begin: () => {
      if (isOpen()) teardown();
      releaseEngine ??= acquireEngineHold(runtimeOf().commands);
      claim.claim(close);
      pendingClick.cancel();
      mixerClick.attach(clickSource);
      songStopSubscription ??= runtimeOf().commands.onSongStopped(() => {
        songStopped();
      });
      if (songTransportListener !== null) {
        songTransportSubscription ??= runtimeOf().commands.onSongTransport(
          songTransportListener,
        );
      }
      return ++session;
    },
    startEngine: async (opened: number): Promise<number | null> => {
      const { commands, engine, sharedMetronome } = runtimeOf();
      if (sharedMetronome.active()) sharedMetronome.release();
      const started = await commands.start();
      const engineRate = engine.sampleRate();
      if (!live(opened)) return null;
      if (started !== KB_RESULT.KB_OK || engineRate <= 0) {
        set({ status: 'failed' });
        return null;
      }
      return engineRate;
    },
    clearSessionLeftovers,
    awaitReset,
  };
}
