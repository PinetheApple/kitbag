import { describe, expect, it } from 'vitest';

import { SET_TEMPO_TEXT } from './manualTempoText.ts';
import { REANALYSIS, watchReanalysis } from './reanalysisWatch.ts';

describe('watchReanalysis', () => {
  it('says nothing unless a re-analysis was asked for', () => {
    expect(watchReanalysis(REANALYSIS.idle, 'failed', null)).toEqual({
      phase: REANALYSIS.idle,
      notice: null,
    });
  });

  it('waits for the run to start before reading its result', () => {
    expect(watchReanalysis(REANALYSIS.asked, 'done', null).phase).toBe(
      REANALYSIS.asked,
    );
    expect(watchReanalysis(REANALYSIS.asked, 'pending', null).phase).toBe(
      REANALYSIS.running,
    );
  });

  it('reports a failed run and keeps quiet afterwards', () => {
    expect(watchReanalysis(REANALYSIS.running, 'failed', 132)).toEqual({
      phase: REANALYSIS.idle,
      notice: SET_TEMPO_TEXT.reanalysisFailed,
    });
  });

  it('reports a run that found no beat', () => {
    expect(watchReanalysis(REANALYSIS.running, 'done', null).notice).toBe(
      SET_TEMPO_TEXT.reanalysisNoBeat,
    );
  });

  it('leaves a found beat to the analysed offer', () => {
    expect(watchReanalysis(REANALYSIS.running, 'done', 132)).toEqual({
      phase: REANALYSIS.idle,
      notice: null,
    });
  });
});
