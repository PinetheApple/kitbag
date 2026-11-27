import type { ManualTempo, ManualTempoChange } from '@kitbag/core-db';

import { manualTempoEditor } from '../manualTempo/editor.ts';
import { manualBpm } from '../manualTempo/manualTempo.ts';
import type { SongPlayerRuntime } from './runtime.ts';
import type { SongPlayerState } from './state.ts';

interface SongManualTempoContext {
  readonly get: () => SongPlayerState;
  readonly set: (change: Partial<SongPlayerState>) => void;
  readonly runtimeOf: () => SongPlayerRuntime;
  readonly session: () => number;
  readonly apply: (change: ManualTempoChange) => void;
}

export function analysedOfferOf(
  manualTempo: ManualTempo | null,
  analysedBpm: number | null,
): number | null {
  if (manualTempo === null || analysedBpm === null) return null;
  return manualBpm(analysedBpm) === manualTempo.bpm ? null : analysedBpm;
}

export function songManualTempo({
  get,
  set,
  runtimeOf,
  session,
  apply,
}: SongManualTempoContext) {
  const editor = manualTempoEditor({
    target: () => {
      const { status, songId, manualTempo, meterOverride } = get();
      return {
        ready: status === 'ready',
        id: songId,
        shown: { manualTempo, meterOverride },
      };
    },
    session,
    save: (id, change) => runtimeOf().records.saveSongManualTempo(id, change),
    refreshLibrary: () => {
      void runtimeOf().library.refresh();
    },
    apply: (change, undoable) => {
      apply(change);
      set({ tempoUndoable: undoable, analysedOffer: null });
    },
    dropUndo: () => {
      set({ tempoUndoable: false });
    },
  });
  return {
    reset: editor.reset,
    actions: {
      setManualTempo: (manualTempo: ManualTempo) => editor.set(manualTempo),
      useAnalysedTempo: async () => {
        const { manualTempo, analysedBpm } = get();
        if (manualTempo === null || analysedBpm === null) return false;
        return editor.clear();
      },
      undoTempo: editor.undo,
      dismissTempoUndo: editor.dismissUndo,
      dismissAnalysedOffer: () => {
        set({ analysedOffer: null });
      },
    },
  };
}

export type SongManualTempoActions = ReturnType<
  typeof songManualTempo
>['actions'];
