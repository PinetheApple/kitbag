import type {
  ManualTempo,
  ManualTempoChange,
  StemSetRecord,
} from '@kitbag/core-db';

import { manualTempoEditor } from '../manualTempo/editor.ts';
import type { ActionContext } from './store.ts';

interface StemManualTempoContext extends ActionContext {
  readonly record: () => StemSetRecord | null;
  readonly apply: (change: ManualTempoChange) => void;
}

// Until #384 a stem song's own grid cannot be replaced, only a missing one supplied.
const hasOwnGrid = (record: StemSetRecord | null) =>
  record !== null && record.beats.length > 0 && record.manualTempo === null;

export function stemManualTempo({
  get,
  set,
  runtimeOf,
  session,
  record,
  apply,
}: StemManualTempoContext) {
  const editor = manualTempoEditor({
    target: () => {
      const { status, setId, manualTempo, meterOverride } = get();
      return {
        ready: status === 'ready',
        id: setId,
        shown: { manualTempo, meterOverride },
      };
    },
    session,
    save: (id, change) =>
      runtimeOf().records.saveStemSetManualTempo(id, change),
    refreshLibrary: () => {
      void runtimeOf().library.refresh();
    },
    apply: (change, undoable) => {
      apply(change);
      set({ tempoUndoable: undoable });
    },
    dropUndo: () => {
      set({ tempoUndoable: false });
    },
  });
  return {
    reset: editor.reset,
    actions: {
      setManualTempo: async (manualTempo: ManualTempo) =>
        hasOwnGrid(record()) ? false : editor.set(manualTempo),
      undoTempo: editor.undo,
      dismissTempoUndo: editor.dismissUndo,
    },
  };
}

export type StemManualTempoActions = ReturnType<
  typeof stemManualTempo
>['actions'];
