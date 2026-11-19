import { TEMPO_MODE, TEMPO_SOURCE, type BundleTempo } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  constantLine,
  tempoCopy,
  tempoHint,
  tempoModeLabel,
  tempoOptions,
  tempoUnavailable,
} from './tempoView.ts';

const FOLLOW: BundleTempo = {
  mode: TEMPO_MODE.follow,
  bpm: 128,
  anchor: 0.42,
  beatsPerBar: 4,
  source: TEMPO_SOURCE.detected,
};
const CONSTANT_ONLY: BundleTempo = { ...FOLLOW, mode: TEMPO_MODE.constant };
const UNFITTED: BundleTempo = { ...FOLLOW, bpm: null, anchor: null };

const disabledOf = (tempo: BundleTempo | null) =>
  tempoOptions(tempo).map((option) => option.disabled ?? false);

describe('the tempo row', () => {
  it("names the grid in StemDeck's words", () => {
    expect(tempoModeLabel(TEMPO_MODE.constant)).toBe('Constant tempo');
    expect(tempoModeLabel(TEMPO_MODE.follow)).toBe('Follow the band');
  });

  it('is unavailable only for a bundle without tempo', () => {
    expect(tempoUnavailable(null)).toBe(tempoCopy.noTempo);
    expect(tempoUnavailable(CONSTANT_ONLY)).toBeNull();
  });
});

describe('the tempo options', () => {
  it('offers both grids for a follow export with a fit', () => {
    expect(tempoOptions(FOLLOW).map((option) => option.label)).toEqual([
      'Constant tempo',
      'Follow the band',
    ]);
    expect(disabledOf(FOLLOW)).toEqual([false, false]);
  });

  it('disables Follow the band for a constant export', () => {
    expect(disabledOf(CONSTANT_ONLY)).toEqual([false, true]);
  });

  it('disables Constant tempo when the follow export has no fit', () => {
    expect(disabledOf(UNFITTED)).toEqual([true, false]);
  });
});

describe('the tempo hints', () => {
  it('give the fitted tempo to one decimal', () => {
    expect(constantLine(FOLLOW)).toBe('Constant: 128.0 BPM');
  });

  it('say why Constant tempo is out of reach with no fit', () => {
    expect(constantLine(UNFITTED)).toBe(
      'StemDeck found no steady tempo in this song.',
    );
  });

  it('say what the chosen grid does', () => {
    expect(tempoHint(FOLLOW, TEMPO_MODE.constant)).toBe(
      'One tempo for the whole song. The click and loop snapping hold steady.',
    );
    expect(tempoHint(FOLLOW, TEMPO_MODE.follow)).toBe(
      'The beats StemDeck heard. The click and loop snapping speed up and slow down with the band.',
    );
  });

  it('give the way out for a constant export', () => {
    expect(tempoHint(CONSTANT_ONLY, TEMPO_MODE.constant)).toBe(
      tempoCopy.constantOnly,
    );
  });
});
