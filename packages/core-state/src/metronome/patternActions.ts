import {
  KB_DENOMINATORS,
  KB_MAX_BEATS,
  KB_POLY_BEATS_BOUNDS,
} from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import type { MetronomeCommands } from './commands.ts';
import { cycleAccentValue, resizeAccents, subdivisionOf } from './config.ts';
import { groupStartAccents } from './meterGroups.ts';
import { normalizePolyAgainst, stepPolyAgainst } from './polyAgainst.ts';
import type { Denominator, MetronomeActions, MetronomeStore } from './store.ts';

const BEATS_MIN = 1;
const VALID_DENOMINATORS = new Set<number>(KB_DENOMINATORS);

export interface Meter {
  readonly beats: number;
  readonly denominator: Denominator;
}

export function meterOf(
  beatsPerBar: number,
  denominator: number,
  current: Denominator,
): Meter | undefined {
  if (!Number.isInteger(beatsPerBar) || beatsPerBar < BEATS_MIN)
    return undefined;
  return {
    beats: Math.min(beatsPerBar, KB_MAX_BEATS),
    denominator: VALID_DENOMINATORS.has(denominator)
      ? (denominator as Denominator)
      : current,
  };
}

type Set = StoreApi<MetronomeStore>['setState'];
type Get = StoreApi<MetronomeStore>['getState'];

export function patternActions(
  set: Set,
  get: Get,
  commands: MetronomeCommands,
): Pick<
  MetronomeActions,
  | 'setBeats'
  | 'setSubdivision'
  | 'cycleAccent'
  | 'setAccents'
  | 'setPoly'
  | 'setPolyAgainst'
  | 'stepPolyAgainst'
  | 'cyclePolyAccent'
  | 'setPolyAccents'
> {
  return {
    setBeats: (beatsPerBar, denominator) => {
      const meter = meterOf(beatsPerBar, denominator, get().denominator);
      if (meter === undefined) return;
      const { beats, denominator: denom } = meter;
      const meterChanged = beats !== get().beatsPerBar;
      const accents = meterChanged ? groupStartAccents(beats) : get().accents;
      const against = get().polyAgainst;
      const polyAgainst = normalizePolyAgainst(against, beats);
      set({ beatsPerBar: beats, denominator: denom, accents, polyAgainst });
      commands.setBeats(beats, denom);
      if (polyAgainst !== against) commands.setPolyAgainst(polyAgainst);
      if (!meterChanged) return;
      accents.forEach((accent, beat) => {
        commands.setAccent(beat, accent);
      });
    },

    setSubdivision: (subdivision) => {
      const next = subdivisionOf(subdivision);
      set({ subdivision: next });
      commands.setSubdivision(next);
    },

    cycleAccent: (beat) => {
      const current = get().accents[beat];
      if (current === undefined) return;
      const next = cycleAccentValue(current);
      set((s) => ({
        accents: s.accents.map((a, i) => (i === beat ? next : a)),
      }));
      commands.setAccent(beat, next);
    },

    setAccents: (accents) => {
      const next = resizeAccents(accents, get().beatsPerBar);
      set({ accents: next });
      next.forEach((accent, beat) => {
        commands.setAccent(beat, accent);
      });
    },

    setPoly: (enabled, beats) => {
      if (!Number.isInteger(beats) || beats < KB_POLY_BEATS_BOUNDS.min) return;
      const polyBeats = Math.min(beats, KB_POLY_BEATS_BOUNDS.max);
      set((s) => ({
        polyEnabled: enabled,
        polyBeats,
        polyAccents: resizeAccents(s.polyAccents, polyBeats),
      }));
      commands.setPoly(enabled, polyBeats);
    },

    setPolyAgainst: (against) => {
      const polyAgainst = normalizePolyAgainst(against, get().beatsPerBar);
      set({ polyAgainst });
      commands.setPolyAgainst(polyAgainst);
    },

    stepPolyAgainst: (delta) => {
      const { polyAgainst, beatsPerBar } = get();
      get().setPolyAgainst(stepPolyAgainst(polyAgainst, delta, beatsPerBar));
    },

    cyclePolyAccent: (beat) => {
      const current = get().polyAccents[beat];
      if (current === undefined) return;
      const next = cycleAccentValue(current);
      set((s) => ({
        polyAccents: s.polyAccents.map((a, i) => (i === beat ? next : a)),
      }));
      commands.setPolyAccent(beat, next);
    },

    setPolyAccents: (accents) => {
      const next = resizeAccents(accents, get().polyBeats);
      set({ polyAccents: next });
      next.forEach((accent, beat) => {
        commands.setPolyAccent(beat, accent);
      });
    },
  };
}
