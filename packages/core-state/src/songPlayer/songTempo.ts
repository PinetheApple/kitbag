import {
  canBuildTempoMode,
  type SongRecord,
  type TempoMode,
} from '@kitbag/core-db';

import { tempoModeSwitch } from '../stemPlayer/tempoActions.ts';
import { tempoModeOf } from '../stemPlayer/tempoGrid.ts';
import { heldWhileSaving } from './heldWhileSaving.ts';
import type { SongPlayerRuntime } from './runtime.ts';
import type { SongPlayerState } from './state.ts';

interface SongTempoContext {
  readonly get: () => SongPlayerState;
  readonly runtimeOf: () => SongPlayerRuntime;
  readonly session: () => number;
}

export function songTempo(
  { get, runtimeOf, session }: SongTempoContext,
  applyGrid: (mode: TempoMode) => void,
) {
  const held = heldWhileSaving<TempoMode>();
  const save = async (id: number, mode: TempoMode) => {
    const saving = held.hold(mode);
    try {
      await runtimeOf().records.saveSongChosenTempoMode(id, mode);
    } finally {
      held.settle(saving);
    }
  };
  const modeFor = (record: Pick<SongRecord, 'tempo' | 'chosenTempoMode'>) => {
    const mode = held.current();
    return mode !== null && canBuildTempoMode(record.tempo, mode)
      ? mode
      : tempoModeOf(record);
  };
  return {
    modeFor,
    reset: held.reset,
    setTempoMode: tempoModeSwitch({
      target: () => {
        const { status, songId, tempo, tempoMode } = get();
        return { ready: status === 'ready', id: songId, tempo, tempoMode };
      },
      session,
      save,
      applyGrid,
    }),
  };
}
