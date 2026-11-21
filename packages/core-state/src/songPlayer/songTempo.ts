import {
  canBuildTempoMode,
  type SongRecord,
  type TempoMode,
} from '@kitbag/core-db';

import { tempoModeSwitch } from '../stemPlayer/tempoActions.ts';
import { tempoModeOf } from '../stemPlayer/tempoGrid.ts';
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
  // Set while a picked mode is saving, so a re-read cannot bring back the older one.
  let held: TempoMode | null = null;
  let saves = 0;
  const save = async (id: number, mode: TempoMode) => {
    const saving = ++saves;
    held = mode;
    try {
      await runtimeOf().records.saveSongChosenTempoMode(id, mode);
    } finally {
      if (saving === saves) held = null;
    }
  };
  return {
    modeFor: (record: Pick<SongRecord, 'tempo' | 'chosenTempoMode'>) =>
      held !== null && canBuildTempoMode(record.tempo, held)
        ? held
        : tempoModeOf(record),
    reset: () => {
      held = null;
    },
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
