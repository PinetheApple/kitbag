import { songMatchKey, type SongIdentity } from '@kitbag/core-db';
import { createStore } from 'zustand/vanilla';

import { BPM_BOUNDS, withinBpmBounds } from '../metronome/config.ts';
import { pushTap, tapTempoBpm } from '../tapTempo/tapTempo.ts';
import { doubledBpm, halvedBpm } from './bpmSteps.ts';
import { climbLadder, NO_TEMPO, type TempoLookup } from './ladder.ts';
import { getTempoLadder, type TempoLadderRuntime } from './runtime.ts';
import { BPM_SOURCE, type BpmSource } from './sources.ts';

export const TAPS_TO_SET_TEMPO = 4;

export interface TempoLadderStore extends TempoLookup {
  readonly track: SongIdentity | null;
  readonly looking: boolean;
  readonly tapsLanded: number;
  readonly lookUp: (track: SongIdentity) => Promise<void>;
  readonly tap: (nowMs: number) => void;
  readonly halve: () => void;
  readonly double: () => void;
  readonly enter: (bpm: number, source?: BpmSource) => void;
}

const UNKNOWN = {
  ...NO_TEMPO,
  track: null,
  looking: false,
  tapsLanded: 0,
};

export function sameSong(
  left: SongIdentity | null,
  right: SongIdentity,
): boolean {
  if (left === null) return false;
  const ours = songMatchKey(left);
  const theirs = songMatchKey(right);
  return ours.title === theirs.title && ours.artist === theirs.artist;
}

async function climbSafely(
  track: SongIdentity,
  runtime: () => TempoLadderRuntime,
): Promise<TempoLookup> {
  try {
    return await climbLadder(track, runtime());
  } catch {
    return NO_TEMPO;
  }
}

export function createTempoLadderStore(runtime: () => TempoLadderRuntime) {
  let taps: readonly number[] = [];
  let latestLookup = 0;
  return createStore<TempoLadderStore>((set, get) => {
    const choose = (bpm: number, source: BpmSource) => {
      set({ bpm: withinBpmBounds(bpm), source });
    };
    const lookUp = async (track: SongIdentity) => {
      if (sameSong(get().track, track)) return;
      latestLookup += 1;
      const lookup = latestLookup;
      taps = [];
      set({ ...UNKNOWN, track, looking: true });
      const found = await climbSafely(track, runtime);
      if (lookup !== latestLookup) return;
      const { tried, libraryMatch } = found;
      set({ looking: false, tried, libraryMatch });
      if (
        found.bpm !== null &&
        found.source !== null &&
        get().source === null
      ) {
        choose(found.bpm, found.source);
      }
    };
    const tap = (nowMs: number) => {
      taps = pushTap(taps, nowMs, BPM_BOUNDS);
      const tapsLanded = Math.min(taps.length, TAPS_TO_SET_TEMPO);
      set({ tapsLanded });
      const tapped = tapTempoBpm(taps);
      if (tapsLanded === TAPS_TO_SET_TEMPO && tapped !== undefined) {
        choose(tapped, BPM_SOURCE.tap);
      }
    };
    const step = (stepped: (bpm: number) => number) => () => {
      const { bpm } = get();
      if (bpm !== null) choose(stepped(bpm), BPM_SOURCE.manual);
    };
    return {
      ...UNKNOWN,
      lookUp,
      tap,
      halve: step(halvedBpm),
      double: step(doubledBpm),
      enter: (bpm, source = BPM_SOURCE.manual) => {
        choose(bpm, source);
      },
    };
  });
}

export const tempoLadderStore = createTempoLadderStore(getTempoLadder);
