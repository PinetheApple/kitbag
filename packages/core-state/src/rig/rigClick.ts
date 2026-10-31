import { KB_RESULT, KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import type { CalibrationDeps } from './calibrationSession.ts';
import { RIG_CLICK_BPM } from './rigClickRules.ts';

export type RigClickDeps = Pick<
  CalibrationDeps,
  'startClick' | 'stopClick' | 'nowFrame'
>;

export type RigClickPhase = 'idle' | 'starting' | 'playing' | 'busy' | 'failed';

export interface RigClick {
  readonly phase: RigClickPhase;
  readonly subdivision: number;
  readonly play: (subdivision?: number) => Promise<void>;
  readonly stop: () => void;
  readonly toggle: () => Promise<void>;
}

export type RigClickStore = StoreApi<RigClick>;

const sounding = (phase: RigClickPhase) =>
  phase === 'starting' || phase === 'playing';

export function createRigClick(deps: RigClickDeps): RigClickStore {
  return createStore<RigClick>((set, get) => {
    let generation = 0;

    const play = async (subdivision: number = KB_SUBDIVISION_BOUNDS.min) => {
      generation += 1;
      const started = generation;
      set({ phase: 'starting', subdivision });
      let result: number;
      try {
        result = await deps.startClick(
          RIG_CLICK_BPM,
          subdivision,
          deps.nowFrame(),
        );
      } catch {
        if (started === generation) set({ phase: 'failed' });
        return;
      }
      if (started !== generation) {
        if (result === KB_RESULT.KB_OK && !sounding(get().phase)) {
          deps.stopClick();
        }
        return;
      }
      if (result === KB_RESULT.KB_OK) set({ phase: 'playing' });
      else if (result === KB_RESULT.KB_ERROR_BUSY) set({ phase: 'busy' });
      else set({ phase: 'failed' });
    };

    const stop = () => {
      generation += 1;
      deps.stopClick();
      set({ phase: 'idle' });
    };

    return {
      phase: 'idle',
      subdivision: KB_SUBDIVISION_BOUNDS.min,
      play,
      stop,
      toggle: () => {
        if (sounding(get().phase)) {
          stop();
          return Promise.resolve();
        }
        return play();
      },
    };
  });
}
