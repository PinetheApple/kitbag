import {
  NO_METER_OVERRIDE,
  type ManualTempo,
  type SongRecord,
  type TempoCorrection,
  type TempoMode,
} from '@kitbag/core-db';

import {
  analysedSongGrid,
  recordGrid,
  type AnalysedSong,
  type SongGrid,
} from './songGrid.ts';
import type { SongPlayerState, TempoPreview } from './state.ts';

type PreviewFacts = Pick<
  SongPlayerState,
  'status' | 'click' | 'tempoMode' | 'tempoCorrection' | 'meterOverride'
> & { readonly toggleClick: () => Promise<void> };

interface TempoPreviewContext {
  readonly get: () => PreviewFacts;
  readonly analysed: () => AnalysedSong;
  readonly showGrid: (grid: SongGrid, facts: Partial<SongPlayerState>) => void;
}

export interface PreviewedGrid {
  readonly grid: SongGrid;
  readonly tempoPreview: TempoPreview;
}

const draftGrid = (
  song: AnalysedSong,
  draft: ManualTempo,
  mode: TempoMode | null,
  correction: TempoCorrection,
) =>
  analysedSongGrid(
    { ...song, manualTempo: draft },
    mode,
    NO_METER_OVERRIDE,
    correction,
  );

export function tempoPreview({ get, analysed, showGrid }: TempoPreviewContext) {
  let draft: ManualTempo | null = null;
  let clickBefore: boolean | null = null;
  const savedGrid = () => {
    const { tempoMode, meterOverride, tempoCorrection } = get();
    return analysedSongGrid(
      analysed(),
      tempoMode,
      meterOverride,
      tempoCorrection,
    );
  };
  const show = (tempo: ManualTempo) => {
    const { click, tempoMode, tempoCorrection } = get();
    const opening = clickBefore === null;
    clickBefore ??= click;
    draft = tempo;
    showGrid(draftGrid(analysed(), tempo, tempoMode, tempoCorrection), {
      tempoPreview: { savedGrid: savedGrid().beats.length > 0 },
    });
    if (opening && !click) void get().toggleClick();
  };
  const restore = () => {
    if (clickBefore === null) return;
    const clickWasOff = !clickBefore;
    clickBefore = null;
    draft = null;
    showGrid(savedGrid(), { tempoPreview: null });
    if (clickWasOff && get().click) void get().toggleClick();
  };
  return {
    reset: () => {
      clickBefore = null;
      draft = null;
    },
    over: (record: SongRecord, mode: TempoMode | null): PreviewedGrid | null =>
      draft === null
        ? null
        : {
            grid: draftGrid(record, draft, mode, record.tempoCorrection),
            tempoPreview: {
              savedGrid: recordGrid(record, mode).beats.length > 0,
            },
          },
    previewTempo: (tempo: ManualTempo | null) => {
      if (get().status !== 'ready') return;
      if (tempo === null) restore();
      else show(tempo);
    },
  };
}
