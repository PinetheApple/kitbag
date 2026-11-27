import { manualBpm, type SongPlayerStore } from '@kitbag/core-state';

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

export interface ReanalysisResult {
  readonly status: AnalysisStatus;
  readonly analysedBpm: number | null;
  readonly manualBpm: number | null;
}

const RUNNING: ReadonlySet<AnalysisStatus> = new Set(['pending', 'analyzing']);

function resultNotice({
  status,
  analysedBpm,
  manualBpm: manual,
}: ReanalysisResult): string | null {
  if (status === 'failed') return SET_TEMPO_TEXT.reanalysisFailed;
  if (analysedBpm === null) return SET_TEMPO_TEXT.reanalysisNoBeat;
  return manualBpm(analysedBpm) === manual
    ? SET_TEMPO_TEXT.reanalysisAgrees
    : null;
}

export function watchReanalysis(
  phase: ReanalysisPhase,
  result: ReanalysisResult,
): ReanalysisStep {
  if (phase === REANALYSIS.idle) return { phase, notice: null };
  if (RUNNING.has(result.status))
    return { phase: REANALYSIS.running, notice: null };
  if (phase === REANALYSIS.asked) return { phase, notice: null };
  return { phase: REANALYSIS.idle, notice: resultNotice(result) };
}
