import {
  NO_METER_OVERRIDE,
  type ManualTempo,
  type MeterOverride,
  type StemSetRecord,
  type TempoMode,
} from '@kitbag/core-db';

import { previewSession } from '../manualTempo/previewSession.ts';
import type { PlaybackShift } from './facts.ts';
import type { Get, SetState, StemPlayerState } from './store.ts';
import { songGrid } from './tempoActions.ts';
import { effectiveGrid } from './tempoGrid.ts';

interface StemTempoPreviewContext {
  readonly get: Get;
  readonly set: SetState;
  readonly record: () => StemSetRecord | null;
  readonly shift: () => PlaybackShift;
  readonly showGrid: (marked: readonly number[]) => void;
}

export function stemTempoPreview({
  get,
  set,
  record,
  shift,
  showGrid,
}: StemTempoPreviewContext) {
  const regrid = (
    song: StemSetRecord,
    mode: TempoMode | null,
    override: MeterOverride,
    kept: Partial<StemPlayerState>,
  ) => {
    const grid = songGrid(song, mode, override, shift());
    set({ ...grid.state, ...kept });
    showGrid(grid.marked);
  };
  const showSaved = (saved: StemSetRecord, mode: TempoMode | null) => {
    regrid(saved, mode, get().meterOverride, { tempoPreview: null });
  };
  const showDraft = (
    saved: StemSetRecord,
    draft: ManualTempo,
    mode: TempoMode | null,
  ) => {
    const { facts, recordedFacts } = get();
    const savedGrid = effectiveGrid(saved, mode).beats.length > 0;
    regrid({ ...saved, manualTempo: draft }, mode, NO_METER_OVERRIDE, {
      facts,
      recordedFacts,
      tempoPreview: { savedGrid },
    });
  };
  const session = previewSession({
    ready: () => get().status === 'ready' && record() !== null,
    click: () => get().click,
    toggleClick: () => get().toggleClick(),
    show: (draft) => {
      const saved = record();
      if (saved !== null) showDraft(saved, draft, get().tempoMode);
    },
    restore: () => {
      const saved = record();
      if (saved !== null) showSaved(saved, get().tempoMode);
    },
  });
  return {
    reset: session.reset,
    previewTempo: session.previewTempo,
    applyGrid: (mode: TempoMode | null) => {
      const saved = record();
      if (saved === null) return;
      const draft = session.draft();
      if (draft === null) showSaved(saved, mode);
      else showDraft(saved, draft, mode);
    },
  };
}
