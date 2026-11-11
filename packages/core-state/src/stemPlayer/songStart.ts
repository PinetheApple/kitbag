import { KB_MIXER_UNITY_RATE, KB_RESULT } from '@kitbag/core-native';

import { countedStart } from './countedStart.ts';
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
}

export interface SongStart {
  readonly play: (headFrame: number) => void;
  readonly cancel: () => boolean;
  readonly counting: () => boolean;
  readonly afterSeek: (frame: number) => void;
  readonly rateSet: (rate: number) => void;
  readonly clickTurnedOff: () => void;
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

// The count hands over to the click on its last frame, so it only runs with
// the song's click on.
export function songStart({
  set,
  get,
  runtimeOf,
  session,
}: SongStartOptions): SongStart {
  let generation = 0;
  let known: SessionRate = { session: session(), rate: KB_MIXER_UNITY_RATE };
  const playbackRate = () =>
    known.session === session() ? known.rate : KB_MIXER_UNITY_RATE;

  const plan = (headFrame: number) => {
    const { click, beats, downbeatIndices, engineRate } = get();
    if (!click) return null;
    const runtime = runtimeOf();
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
    if (get().countEndFrame !== null) set({ countEndFrame: null });
  };

  const rearmClick = () => {
    const { commands, engine } = runtimeOf();
    if (get().click) commands.metronomeStart(engine.nowFrame());
  };

  const play = (headFrame: number) => {
    const { commands } = runtimeOf();
    const counted = plan(headFrame);
    if (counted === null) {
      commands.mixerPlay();
      return;
    }
    const mine = ++generation;
    const opened = session();
    commands.mixerSeek(counted.startFrame);
    set({ countEndFrame: counted.endFrame });
    void commands
      .songCountIn(counted.endFrame, counted.beatFrames, counted.beatsPerBar)
      .catch(() => KB_RESULT.KB_ERROR_INTERNAL)
      .then((result) => {
        if (result === KB_RESULT.KB_OK) return;
        if (mine !== generation || opened !== session()) return;
        forget();
        rearmClick();
        runtimeOf().commands.mixerPlay();
      });
  };

  const cancel = () => {
    if (!counting()) return false;
    forget();
    runtimeOf().commands.songPause();
    rearmClick();
    return true;
  };

  const recount = (frame: number) => {
    if (cancel()) play(frame);
  };

  return {
    play,
    cancel,
    counting,
    afterSeek: recount,
    rateSet: (rate) => {
      const changed = rate !== playbackRate();
      known = { session: session(), rate };
      if (changed) recount(runtimeOf().engine.position());
    },
    clickTurnedOff: () => {
      if (!counting()) return;
      forget();
      runtimeOf().commands.mixerPlay();
    },
  };
}
