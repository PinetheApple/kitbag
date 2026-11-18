import { KB_MIXER_UNITY_RATE, KB_RESULT } from '@kitbag/core-native';

import { countedStart, type CountedStart } from './countedStart.ts';
import type { MixerRuntime, StemPlayerRuntime } from './runtime.ts';
import type { StemPlayerState } from './store.ts';

export type SongStartSlice = Pick<
  StemPlayerState,
  'click' | 'beats' | 'downbeatIndices' | 'engineRate' | 'countEndFrame'
>;

export type SongStartRuntime = MixerRuntime &
  Pick<StemPlayerRuntime, 'countInBars'>;

export interface SongStartOptions {
  readonly set: (change: Pick<SongStartSlice, 'countEndFrame'>) => void;
  readonly get: () => SongStartSlice;
  readonly runtimeOf: () => SongStartRuntime;
  readonly session: () => number;
  readonly releaseClick: () => boolean;
}

export interface SongStart {
  readonly play: (headFrame: number) => void;
  readonly cancel: () => boolean;
  readonly stop: () => boolean;
  readonly songStopped: () => void;
  readonly counting: () => boolean;
  readonly afterSeek: (frame: number) => void;
  readonly rateSet: (rate: number) => void;
  readonly gridReplaced: () => void;
  readonly recountWithClickOff: () => boolean;
  readonly recountWithClickOn: () => boolean;
  readonly endCountNow: () => void;
}

export function countPending(
  countEndFrame: number | null,
  nowFrame: number,
): boolean {
  return countEndFrame !== null && nowFrame < countEndFrame;
}

interface SessionRate {
  readonly session: number;
  readonly rate: number;
}

export function songStart({
  set,
  get,
  runtimeOf,
  session,
  releaseClick,
}: SongStartOptions): SongStart {
  let generation = 0;
  let pending: CountedStart | null = null;
  let known: SessionRate = { session: session(), rate: KB_MIXER_UNITY_RATE };
  const playbackRate = () =>
    known.session === session() ? known.rate : KB_MIXER_UNITY_RATE;

  const plan = (headFrame: number) => {
    const { beats, downbeatIndices, engineRate } = get();
    const runtime = runtimeOf();
    if (runtime.sharedMetronome.active()) return null;
    return countedStart({
      headFrame,
      nowFrame: runtime.engine.nowFrame(),
      engineRate,
      playbackRate: playbackRate(),
      bars: runtime.countInBars(),
      beats,
      downbeatIndices,
    });
  };

  const counting = () =>
    countPending(get().countEndFrame, runtimeOf().engine.nowFrame());

  const forget = () => {
    generation++;
    pending = null;
    if (get().countEndFrame !== null) set({ countEndFrame: null });
  };

  const rearmClick = () => {
    const { commands, engine } = runtimeOf();
    if (get().click) commands.metronomeStart(engine.nowFrame());
  };

  const settleClick = () => {
    if (get().click) rearmClick();
    else runtimeOf().commands.metronomeStop();
  };

  const startNow = () => {
    forget();
    settleClick();
    runtimeOf().commands.mixerPlay();
  };

  const countIn = (counted: CountedStart, startClick: boolean) => {
    const mine = ++generation;
    const opened = session();
    pending = counted;
    set({ countEndFrame: counted.endFrame });
    void runtimeOf()
      .commands.songCountIn(
        counted.endFrame,
        counted.beatFrames,
        counted.beatsPerBar,
        startClick,
      )
      .catch(() => KB_RESULT.KB_ERROR_INTERNAL)
      .then((result) => {
        if (result === KB_RESULT.KB_OK) return;
        if (mine !== generation || opened !== session()) return;
        startNow();
      });
  };

  const play = (headFrame: number) => {
    const { commands } = runtimeOf();
    const counted = plan(headFrame);
    if (counted === null) {
      commands.mixerPlay();
      return;
    }
    commands.mixerSeek(counted.startFrame);
    countIn(counted, get().click);
  };

  const cancel = () => {
    if (!counting()) return false;
    forget();
    runtimeOf().commands.songPause();
    rearmClick();
    return true;
  };

  const stop = () => {
    if (!counting()) return false;
    forget();
    runtimeOf().commands.songStop();
    releaseClick();
    return true;
  };

  const songStopped = () => {
    const counted = counting();
    if (counted) forget();
    const clicked = releaseClick();
    if (counted || clicked) runtimeOf().commands.metronomeStop();
  };

  const recount = (frame: number) => {
    if (cancel()) play(frame);
  };

  const recountWith = (startClick: boolean) => {
    if (pending === null || !counting()) return false;
    countIn(pending, startClick);
    return true;
  };

  return {
    play,
    cancel,
    stop,
    songStopped,
    counting,
    afterSeek: recount,
    rateSet: (rate) => {
      const changed = rate !== playbackRate();
      known = { session: session(), rate };
      if (changed) recount(runtimeOf().engine.position());
    },
    gridReplaced: () => {
      recount(runtimeOf().engine.position());
    },
    recountWithClickOff: () => recountWith(false),
    recountWithClickOn: () => recountWith(true),
    endCountNow: () => {
      if (counting()) startNow();
    },
  };
}
