import {
  GRID_METER,
  TEMPO_CORRECTION,
  TEMPO_MODE,
  TEMPO_SOURCE,
} from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { recordGrid } from './songGrid.ts';
import { songRecord } from './store.test-helper.ts';

const MANUAL = { bpm: 60, anchor: 1.25, beatsPerBar: GRID_METER.triple };
const DURATION_SEC = 8;

const manualSong = songRecord({
  durationSec: DURATION_SEC,
  manualTempo: MANUAL,
  tempoCorrection: TEMPO_CORRECTION.double,
  tempo: {
    mode: TEMPO_MODE.follow,
    bpm: 120,
    anchor: 0,
    beatsPerBar: 4,
    source: TEMPO_SOURCE.analysed,
  },
  chosenTempoMode: TEMPO_MODE.constant,
});

describe('the grid of a song with a manual tempo', () => {
  it('is the constant grid from bar 1, whatever the analysis, correction or mode', () => {
    const grid = recordGrid(manualSong);
    expect(grid.beats).toEqual([
      0.25, 1.25, 2.25, 3.25, 4.25, 5.25, 6.25, 7.25,
    ]);
    expect(grid.downbeatIndices.map((i) => grid.beats[i])).toEqual([
      1.25, 4.25, 7.25,
    ]);
  });

  it('takes a meter override on top', () => {
    const grid = recordGrid({
      ...manualSong,
      meterBeatsPerBar: GRID_METER.quadruple,
    });
    expect(grid.downbeatIndices.map((i) => grid.beats[i])).toEqual([
      1.25, 5.25,
    ]);
  });
});
