import { NO_METER_OVERRIDE, type ManualTempo } from '@kitbag/core-db';

import {
  analysedSongGrid,
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

export function tempoPreview({ get, analysed, showGrid }: TempoPreviewContext) {
  let clickBefore: boolean | null = null;
  const show = (tempo: ManualTempo) => {
    const { click, tempoMode, tempoCorrection } = get();
    clickBefore ??= click;
    const song = { ...analysed(), manualTempo: tempo };
    showGrid(
      analysedSongGrid(song, tempoMode, NO_METER_OVERRIDE, tempoCorrection),
      { tempoPreview: true },
    );
  };
  const restore = () => {
    if (clickBefore === null) return;
    const clickWasOff = !clickBefore;
    clickBefore = null;
    const { tempoMode, meterOverride, tempoCorrection } = get();
    showGrid(
      analysedSongGrid(analysed(), tempoMode, meterOverride, tempoCorrection),
      { tempoPreview: false },
    );
    if (clickWasOff && get().click) void get().toggleClick();
  };
  return {
    reset: () => {
      clickBefore = null;
    },
    previewTempo: (tempo: ManualTempo | null) => {
      if (get().status !== 'ready') return;
      if (tempo === null) restore();
      else show(tempo);
    },
  };
}
