import {
  NO_METER_OVERRIDE,
  type ManualTempo,
  type SongRecord,
  type TempoCorrection,
  type TempoMode,
} from '@kitbag/core-db';

import {
  previewSession,
  type TempoPreview,
} from '../manualTempo/previewSession.ts';
import {
  analysedSongGrid,
  recordGrid,
  type AnalysedSong,
  type SongGrid,
} from './songGrid.ts';
import type { SongPlayerState } from './state.ts';

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
  const savedGrid = () => {
    const { tempoMode, meterOverride, tempoCorrection } = get();
    return analysedSongGrid(
      analysed(),
      tempoMode,
      meterOverride,
      tempoCorrection,
    );
  };
  const session = previewSession({
    ready: () => get().status === 'ready',
    click: () => get().click,
    toggleClick: () => get().toggleClick(),
    show: (tempo) => {
      const { tempoMode, tempoCorrection } = get();
      showGrid(draftGrid(analysed(), tempo, tempoMode, tempoCorrection), {
        tempoPreview: { savedGrid: savedGrid().beats.length > 0 },
      });
    },
    restore: () => {
      showGrid(savedGrid(), { tempoPreview: null });
    },
  });
  return {
    reset: session.reset,
    over: (record: SongRecord, mode: TempoMode | null): PreviewedGrid | null => {
      const draft = session.draft();
      return draft === null
        ? null
        : {
            grid: draftGrid(record, draft, mode, record.tempoCorrection),
            tempoPreview: {
              savedGrid: recordGrid(record, mode).beats.length > 0,
            },
          };
    },
    previewTempo: session.previewTempo,
  };
}
