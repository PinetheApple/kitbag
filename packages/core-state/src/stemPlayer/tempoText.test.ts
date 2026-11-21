import { TEMPO_MODE, TEMPO_SOURCE, type BundleTempo } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  constantLine,
  tempoHint,
  tempoModeLabel,
  tempoOptions,
  tempoSheetView,
  tempoText,
  tempoUnavailable,
} from './tempoText.ts';

const FOLLOW: BundleTempo = {
  mode: TEMPO_MODE.follow,
  bpm: 128,
  anchor: 0.42,
  beatsPerBar: 4,
  source: TEMPO_SOURCE.detected,
};
const CONSTANT_ONLY: BundleTempo = { ...FOLLOW, mode: TEMPO_MODE.constant };
const UNFITTED: BundleTempo = { ...FOLLOW, bpm: null, anchor: null };
const ANALYSED: BundleTempo = { ...FOLLOW, source: TEMPO_SOURCE.analysed };
const ANALYSED_UNFITTED: BundleTempo = { ...UNFITTED, ...ANALYSED, bpm: null };

const disabledOf = (tempo: BundleTempo | null) =>
  tempoOptions(tempo).map((option) => option.disabled ?? false);

describe('the tempo row', () => {
  it("names the grid in StemDeck's words", () => {
    expect(tempoModeLabel(TEMPO_MODE.constant)).toBe('Constant tempo');
    expect(tempoModeLabel(TEMPO_MODE.follow)).toBe('Follow the band');
    expect(tempoModeLabel(null)).toBe('');
  });

  it('is unavailable only for a stem song without tempo', () => {
    expect(tempoUnavailable(null, 'stems')).toBe(tempoText.noTempo);
    expect(tempoUnavailable(CONSTANT_ONLY, 'stems')).toBeNull();
  });

  it('waits for the analysis on a song Kitbag has not fitted yet', () => {
    expect(tempoUnavailable(null, 'song')).toBe(
      'Available once Kitbag analyses this song again.',
    );
    expect(tempoUnavailable(ANALYSED, 'song')).toBeNull();
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
    expect(tempoHint(FOLLOW, TEMPO_MODE.constant, 'stems')).toBe(
      'One tempo for the whole song. The click and loop snapping hold steady.',
    );
    expect(tempoHint(FOLLOW, TEMPO_MODE.follow, 'stems')).toBe(
      'The beats StemDeck heard. The click and loop snapping speed up and slow down with the band.',
    );
  });

  it('give the way out for a constant export', () => {
    expect(tempoHint(CONSTANT_ONLY, TEMPO_MODE.constant, 'stems')).toBe(
      tempoText.constantOnly,
    );
  });
});

describe('the tempo sheet view', () => {
  it('has no hint until a tempo and a mode are known', () => {
    expect(tempoSheetView(FOLLOW, null, 'song').hint).toBeNull();
    expect(tempoSheetView(null, TEMPO_MODE.follow, 'song')).toEqual({
      options: tempoOptions(null),
      constantLine: null,
      hint: null,
    });
  });
});

describe('the tempo hints for a fit Kitbag made', () => {
  it("name Kitbag as the one that heard a song's beats", () => {
    expect(tempoHint(ANALYSED, TEMPO_MODE.follow, 'song')).toBe(
      'The beats Kitbag heard. The click and loop snapping speed up and slow down with the band.',
    );
  });

  it("name StemDeck as the one that heard a stem song's beats", () => {
    expect(tempoHint(ANALYSED, TEMPO_MODE.follow, 'stems')).toBe(
      'The beats StemDeck heard. The click and loop snapping speed up and slow down with the band.',
    );
  });

  it('name Kitbag as the one that found no steady tempo', () => {
    expect(constantLine(ANALYSED_UNFITTED)).toBe(
      'Kitbag found no steady tempo in this song.',
    );
  });
});
