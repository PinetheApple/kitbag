import { describe, expect, it } from 'vitest';

import { SET_TEMPO_TEXT } from './manualTempoText.ts';
import { REANALYSIS, watchReanalysis } from './reanalysisWatch.ts';

const MANUAL_BPM = 128;
const result = (
  status: 'pending' | 'analyzing' | 'done' | 'failed',
  analysedBpm: number | null,
) => ({ status, analysedBpm, manualBpm: MANUAL_BPM });

describe('watchReanalysis', () => {
  it('says nothing unless a re-analysis was asked for', () => {
    expect(watchReanalysis(REANALYSIS.idle, result('failed', null))).toEqual({
      phase: REANALYSIS.idle,
      notice: null,
    });
  });

  it('waits for the run to start before reading its result', () => {
    expect(watchReanalysis(REANALYSIS.asked, result('done', null)).phase).toBe(
      REANALYSIS.asked,
    );
    expect(
      watchReanalysis(REANALYSIS.asked, result('pending', null)).phase,
    ).toBe(REANALYSIS.running);
  });

  it('reports a failed run and keeps quiet afterwards', () => {
    expect(watchReanalysis(REANALYSIS.running, result('failed', 132))).toEqual({
      phase: REANALYSIS.idle,
      notice: SET_TEMPO_TEXT.reanalysisFailed,
    });
  });

  it('reports a run that found no beat', () => {
    expect(
      watchReanalysis(REANALYSIS.running, result('done', null)).notice,
    ).toBe(SET_TEMPO_TEXT.reanalysisNoBeat);
  });

  it('says when the analysis agrees with the manual tempo', () => {
    expect(
      watchReanalysis(REANALYSIS.running, result('done', MANUAL_BPM + 0.04))
        .notice,
    ).toBe(SET_TEMPO_TEXT.reanalysisAgrees);
  });

  it('leaves a different tempo to the analysed offer', () => {
    expect(watchReanalysis(REANALYSIS.running, result('done', 132))).toEqual({
      phase: REANALYSIS.idle,
      notice: null,
    });
  });
});
