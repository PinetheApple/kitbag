import type { SongIdentity } from '@kitbag/core-db';
import { createStore } from 'zustand/vanilla';

import { BPM_BOUNDS } from '../metronome/config.ts';
import { pushTap, tapTempoBpm } from '../tapTempo/tapTempo.ts';
import { doubledBpm, halvedBpm, withinBpmBounds } from './bpmSteps.ts';
import { climbLadder, type TempoLookup } from './ladder.ts';
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
  readonly enter: (bpm: number) => void;
}

const UNKNOWN = {
  track: null,
  looking: false,
  bpm: null,
  source: null,
  tried: [],
  libraryMatch: null,
  tapsLanded: 0,
} as const;

export function createTempoLadderStore(runtime: () => TempoLadderRuntime) {
  let taps: readonly number[] = [];
  let latestLookup = 0;
  return createStore<TempoLadderStore>((set, get) => {
    const choose = (bpm: number, source: BpmSource) => {
      set({ bpm: withinBpmBounds(bpm), source });
    };
    const lookUp = async (track: SongIdentity) => {
      latestLookup += 1;
      const lookup = latestLookup;
      taps = [];
      set({ ...UNKNOWN, track, looking: true });
      const found = await climbLadder(track, runtime());
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
      enter: (bpm) => {
        choose(bpm, BPM_SOURCE.manual);
      },
    };
  });
}

export const tempoLadderStore = createTempoLadderStore(getTempoLadder);
