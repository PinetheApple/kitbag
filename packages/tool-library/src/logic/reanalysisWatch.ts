import type { SongPlayerStore } from '@kitbag/core-state';

import { SET_TEMPO_TEXT } from './manualTempoText.ts';

export const REANALYSIS = {
  idle: 'idle',
  asked: 'asked',
  running: 'running',
} as const;

export type ReanalysisPhase = (typeof REANALYSIS)[keyof typeof REANALYSIS];
type AnalysisStatus = SongPlayerStore['analysisStatus'];

export interface ReanalysisStep {
  readonly phase: ReanalysisPhase;
  readonly notice: string | null;
}

const RUNNING: ReadonlySet<AnalysisStatus> = new Set(['pending', 'analyzing']);

export function watchReanalysis(
  phase: ReanalysisPhase,
  status: AnalysisStatus,
  analysedBpm: number | null,
): ReanalysisStep {
  if (phase === REANALYSIS.idle) return { phase, notice: null };
  if (RUNNING.has(status)) return { phase: REANALYSIS.running, notice: null };
  if (phase === REANALYSIS.asked) return { phase, notice: null };
  if (status === 'failed')
    return { phase: REANALYSIS.idle, notice: SET_TEMPO_TEXT.reanalysisFailed };
  return {
    phase: REANALYSIS.idle,
    notice: analysedBpm === null ? SET_TEMPO_TEXT.reanalysisNoBeat : null,
  };
}
