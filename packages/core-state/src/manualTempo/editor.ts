import {
  NO_METER_OVERRIDE,
  type ManualTempo,
  type ManualTempoChange,
} from '@kitbag/core-db';

import { warn } from '../songLibrary/storeSupport.ts';

export interface ManualTempoTarget {
  readonly ready: boolean;
  readonly id: number | null;
  readonly shown: ManualTempoChange;
}

export interface ManualTempoEditorContext {
  readonly target: () => ManualTempoTarget;
  readonly session: () => number;
  readonly save: (id: number, change: ManualTempoChange) => Promise<void>;
  readonly refreshLibrary: () => void;
  readonly apply: (change: ManualTempoChange, undoable: boolean) => void;
  readonly dropUndo: () => void;
}

export function manualTempoEditor({
  target,
  session,
  save,
  refreshLibrary,
  apply,
  dropUndo,
}: ManualTempoEditorContext) {
  let undo: ManualTempoChange | null = null;
  const change = async (
    next: ManualTempoChange,
    undoTo: ManualTempoChange | null,
  ) => {
    const { ready, id } = target();
    if (!ready || id === null) return false;
    const opened = session();
    try {
      await save(id, next);
    } catch (error: unknown) {
      warn('manual tempo not stored', error);
      return false;
    }
    refreshLibrary();
    if (opened !== session()) return false;
    undo = undoTo;
    apply(next, undoTo !== null);
    return true;
  };
  return {
    reset: () => {
      undo = null;
    },
    set: (manualTempo: ManualTempo) =>
      change({ manualTempo, meterOverride: NO_METER_OVERRIDE }, target().shown),
    clear: () => {
      const { shown } = target();
      return change(
        { manualTempo: null, meterOverride: shown.meterOverride },
        shown,
      );
    },
    undo: async () => (undo === null ? false : change(undo, null)),
    dismissUndo: () => {
      undo = null;
      dropUndo();
    },
  };
}
