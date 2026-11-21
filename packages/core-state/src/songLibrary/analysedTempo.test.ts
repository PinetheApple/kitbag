import { GRID_METER, TEMPO_MODE, TEMPO_SOURCE } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { analysedTempo } from './analysedTempo.ts';
import { resultRecord } from './analysisRecord.ts';
import { result } from './store.test-helper.ts';

const THREE_FOUR = {
  beats: [0, 0.5, 1, 1.5, 2, 2.5, 3],
  downbeatIndices: [0, 3, 6],
};
const FIT = { bpm: 121.5, anchor: 0.25, beatsPerBar: GRID_METER.triple };

describe('a tempo fit over analysed beats', () => {
  it('becomes a follow tempo Kitbag found', () => {
    expect(analysedTempo(FIT, THREE_FOUR)).toEqual({
      mode: TEMPO_MODE.follow,
      ...FIT,
      source: TEMPO_SOURCE.analysed,
    });
  });

  it('keeps the meter it heard when the fit found no steady tempo', () => {
    expect(analysedTempo(null, THREE_FOUR)).toEqual({
      mode: TEMPO_MODE.follow,
      bpm: null,
      anchor: null,
      beatsPerBar: GRID_METER.triple,
      source: TEMPO_SOURCE.analysed,
    });
  });

  it('reads a fit outside the tempo limits as no steady tempo', () => {
    expect(analysedTempo({ ...FIT, bpm: 900 }, THREE_FOUR)).toMatchObject({
      bpm: null,
      anchor: null,
    });
    expect(analysedTempo({ ...FIT, beatsPerBar: 0 }, THREE_FOUR)).toMatchObject(
      { bpm: null, beatsPerBar: GRID_METER.triple },
    );
  });

  it('is no tempo at all without beats', () => {
    expect(analysedTempo(FIT, { beats: [], downbeatIndices: [] })).toBeNull();
  });
});

describe('an analysis result with a tempo fit', () => {
  const fitted = { bpm: 121.5, anchorSec: 0.25, beatsPerBar: 4 };

  it('carries the fit to the record', () => {
    expect(resultRecord(result({ tempo: fitted }))).toMatchObject({
      tempo: {
        mode: TEMPO_MODE.follow,
        bpm: 121.5,
        anchor: 0.25,
        beatsPerBar: 4,
        source: TEMPO_SOURCE.analysed,
      },
    });
  });

  it('records no steady tempo when the fit failed', () => {
    expect(resultRecord(result({ tempo: null }))).toMatchObject({
      tempo: { bpm: null, anchor: null, source: TEMPO_SOURCE.analysed },
    });
  });

  it('records no tempo from an analyser too old to fit one', () => {
    expect(result()).not.toHaveProperty('tempo');
    expect(resultRecord(result())).toMatchObject({ tempo: null });
  });
});
