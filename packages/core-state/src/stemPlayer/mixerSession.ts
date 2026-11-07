import {
  acquireEngineHold,
  KB_MIXER_UNITY_RATE,
  KB_RESULT,
} from '@kitbag/core-native';

import { stopClick, turnClickOff, type ClickSlice } from './clickActions.ts';
import { debounce } from './debounce.ts';
import type { MixerClaim } from './mixerClaim.ts';
import type { MixerRuntime, StemPlayerCommands } from './runtime.ts';
import type { StemPlayerState } from './store.ts';

export interface MixerSessionContext<Slice> {
  readonly set: (change: Partial<Slice>) => void;
  readonly get: () => Slice;
  readonly runtimeOf: () => MixerRuntime;
  readonly session: () => number;
}

type SessionSlice = ClickSlice & Pick<StemPlayerState, 'loop'>;

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
  readonly isOpen: () => boolean;
  readonly beforeTeardown?: () => void;
  readonly teardownTracks: () => void;
  readonly resetState: () => void;
}

export function mixerSession({
  set,
  get,
  runtimeOf,
  scrubSeekDelayMs,
  claim,
  isOpen,
  beforeTeardown,
  teardownTracks,
  resetState,
}: MixerSessionOptions) {
  let session = 0;
  let releaseEngine: (() => void) | null = null;
  let songStopSubscription: ReturnType<
    StemPlayerCommands['onSongStopped']
  > | null = null;
  const scrubSeek = debounce((frame: number) => {
    runtimeOf().commands.mixerSeek(frame);
  }, scrubSeekDelayMs);
  const live = (opened: number) => opened === session;

  const teardown = () => {
    beforeTeardown?.();
    const runtime = runtimeOf();
    const { commands } = runtime;
    const { click, loop } = get();
    scrubSeek.cancel();
    if (click) stopClick(runtime);
    commands.songTransportHide();
    commands.mixerStop();
    if (loop.kind === 'on') void commands.mixerClearLoop().catch(() => null);
    teardownTracks();
  };

  // A second close, from a screen whose session was already displaced, must
  // not stop whatever displaced it.
  const close = () => {
    if (!isOpen()) return;
    claim.release(close);
    session++;
    teardown();
    resetState();
    releaseEngine?.();
    releaseEngine = null;
    songStopSubscription?.remove();
    songStopSubscription = null;
  };

  return {
    scrubSeek,
    live,
    close,
    current: () => session,
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
      songStopSubscription ??= runtimeOf().commands.onSongStopped(() => {
        turnClickOff({ set, get, runtimeOf });
      });
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
      // A loop a failed clear left behind would otherwise play in this song.
      await commands.mixerClearLoop().catch(() => null);
      // The rate is engine-wide and outlives stop and unload.
      const rate = await commands.mixerRate();
      if (!live(opened)) return null;
      if (rate !== KB_MIXER_UNITY_RATE)
        await commands.mixerSetRate(KB_MIXER_UNITY_RATE);
      return live(opened) ? engineRate : null;
    },
  };
}
