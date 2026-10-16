import {
  KB_DENOMINATORS,
  KB_MAX_BEATS,
  KB_POLY_BEATS_BOUNDS,
  KB_SUBDIVISION_BOUNDS,
} from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import type { MetronomeCommands } from './commands.ts';
import { clamp, cycleAccentValue, resizeAccents } from './config.ts';
import type { Denominator, MetronomeActions, MetronomeStore } from './store.ts';

const BEATS_MIN = 1;
const VALID_DENOMINATORS = new Set<number>(KB_DENOMINATORS);

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
  | 'cyclePolyAccent'
  | 'setPolyAccents'
> {
  return {
    setBeats: (beatsPerBar, denominator) => {
      if (!Number.isInteger(beatsPerBar) || beatsPerBar < BEATS_MIN) return;
      const beats = Math.min(beatsPerBar, KB_MAX_BEATS);
      const denom: Denominator = VALID_DENOMINATORS.has(denominator)
        ? (denominator as Denominator)
        : get().denominator;
      set((s) => ({
        beatsPerBar: beats,
        denominator: denom,
        accents: resizeAccents(s.accents, beats),
      }));
      commands.setBeats(beats, denom);
    },

    setSubdivision: (subdivision) => {
      const next = clamp(
        Math.trunc(subdivision),
        KB_SUBDIVISION_BOUNDS.min,
        KB_SUBDIVISION_BOUNDS.max,
      );
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
