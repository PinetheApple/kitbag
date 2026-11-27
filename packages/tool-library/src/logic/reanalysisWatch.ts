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
  readonly offer: boolean;
}

export interface ReanalysisResult {
  readonly status: AnalysisStatus;
  readonly analysedBpm: number | null;
  readonly manualTempoBpm: number | null;
}

const RUNNING: ReadonlySet<AnalysisStatus> = new Set(['pending', 'analyzing']);
const QUIET = { notice: null, offer: false } as const;

function ended({
  status,
  analysedBpm,
  manualTempoBpm,
}: ReanalysisResult): Omit<ReanalysisStep, 'phase'> {
  if (status === 'failed')
    return { notice: SET_TEMPO_TEXT.reanalysisFailed, offer: false };
  if (analysedBpm === null)
    return { notice: SET_TEMPO_TEXT.reanalysisNoBeat, offer: false };
  return manualBpm(analysedBpm) === manualTempoBpm
    ? { notice: SET_TEMPO_TEXT.reanalysisAgrees, offer: false }
    : { notice: null, offer: true };
}

export function watchReanalysis(
  phase: ReanalysisPhase,
  result: ReanalysisResult,
): ReanalysisStep {
  if (phase === REANALYSIS.idle) return { phase, ...QUIET };
  if (RUNNING.has(result.status))
    return { phase: REANALYSIS.running, ...QUIET };
  if (phase === REANALYSIS.asked) return { phase, ...QUIET };
  return { phase: REANALYSIS.idle, ...ended(result) };
}
