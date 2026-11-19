import { CLICK_RATE } from '@kitbag/core-state';
import { KB_MAX_BEATS, KB_MAX_GRID_GROUPS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  barCounts,
  builderHint,
  canAddGroup,
  clickBeats,
  groupingLabel,
  groupingPick,
  groupingPresets,
  mismatchNote,
  rateLabel,
  stripBarBeats,
} from './clickView.ts';

const positions = (levels: readonly (readonly string[])[], wanted: string) =>
  levels.flat().flatMap((level, i) => (level === wanted ? [i] : []));
const sounding = (levels: readonly (readonly string[])[]) =>
  levels.flat().flatMap((level, i) => (level === 'silent' ? [] : [i]));

describe('the beats a grouping clicks', () => {
  it('accents the bar and each later group of 3+2+2', () => {
    expect(clickBeats([3, 2, 2], 7, CLICK_RATE.single)).toEqual([
      ['bar', 'click', 'click'],
      ['group', 'click'],
      ['group', 'click'],
    ]);
  });

  it('sounds 0, 2, 3 and 5 of 3+2+2 at half rate, counting again in each group', () => {
    const levels = clickBeats([3, 2, 2], 7, CLICK_RATE.half);
    expect(sounding(levels)).toEqual([0, 2, 3, 5]);
    expect(levels.flat().slice(0, 6)).toEqual([
      'bar',
      'silent',
      'click',
      'group',
      'silent',
      'group',
    ]);
  });

  it('sounds 0, 2, 4 and 5 of 2+3+2 at half rate, where counting by bar would not', () => {
    const levels = clickBeats([2, 3, 2], 7, CLICK_RATE.half);
    expect(sounding(levels)).toEqual([0, 2, 4, 5]);
  });

  it('sounds 0, 2, 4 and 6 of 2+2+3 at half rate', () => {
    const levels = clickBeats([2, 2, 3], 7, CLICK_RATE.half);
    expect(sounding(levels)).toEqual([0, 2, 4, 6]);
    expect(positions(levels, 'group')).toEqual([2, 4]);
    expect(levels.flat()[6]).toBe('click');
  });

  it('keeps only the downbeat accent on a bar of another length', () => {
    expect(clickBeats([3, 2, 2], 6, CLICK_RATE.single)).toEqual([
      ['bar', 'click', 'click', 'click', 'click', 'click'],
    ]);
  });

  it('counts half rate from the downbeat with no grouping', () => {
    expect(sounding(clickBeats([], 5, CLICK_RATE.half))).toEqual([0, 2, 4]);
  });

  it('marks no beat silent at double rate', () => {
    expect(
      positions(clickBeats([3, 2, 2], 7, CLICK_RATE.double), 'silent'),
    ).toEqual([]);
  });
});

describe('grouping presets', () => {
  it("come from the song's bar length", () => {
    expect(groupingPresets(7)).toEqual([
      [3, 2, 2],
      [2, 2, 3],
      [2, 3, 2],
    ]);
    expect(groupingPresets(4)).toEqual([[2, 2]]);
    expect(groupingPresets(9)).toEqual([
      [3, 3, 3],
      [2, 2, 2, 3],
    ]);
  });

  it('are none for a bar with no sensible split', () => {
    expect(groupingPresets(3)).toEqual([]);
    expect(groupingPresets(11)).toEqual([]);
  });

  it('pick the matching preset, Off, or Custom', () => {
    const presets = groupingPresets(7);
    expect(groupingPick([2, 2, 3], presets, false)).toBe('2+2+3');
    expect(groupingPick([], presets, false)).toBe('off');
    expect(groupingPick([3, 2], presets, false)).toBe('custom');
    expect(groupingPick([3, 2, 2], presets, true)).toBe('custom');
  });
});

describe('labels', () => {
  it('names groupings and rates', () => {
    expect(groupingLabel([])).toBe('Off');
    expect(groupingLabel([3, 2, 2])).toBe('3+2+2');
    expect(rateLabel(CLICK_RATE.half)).toBe('×1/2');
    expect(rateLabel(CLICK_RATE.single)).toBe('×1');
    expect(rateLabel(CLICK_RATE.double)).toBe('×2');
  });
});

describe("the song's bars", () => {
  const MIXED = [0, 7, 14, 20, 27];

  it('counts each bar length between downbeats', () => {
    expect([...barCounts(MIXED)]).toEqual([
      [7, 3],
      [6, 1],
    ]);
  });

  it('draws the strip at the grouping length when bars of it exist', () => {
    const counts = barCounts(MIXED);
    expect(stripBarBeats([2, 2, 2], counts, 7)).toBe(6);
    expect(stripBarBeats([3, 2], counts, 7)).toBe(7);
  });

  it('notes the bars a grouping misses, and when it misses them all', () => {
    const counts = barCounts(MIXED);
    expect(mismatchNote([3, 2, 2], counts)).toEqual({
      text: "1 of 4 bars in this song are 6 beats long. They don't match 3+2+2, so they accent only their first beat:",
      barBeats: 6,
    });
    expect(mismatchNote([2, 2], counts)?.text).toBe(
      'No bar in this song is 4 beats long, so every bar keeps only its first-beat accent.',
    );
    expect(mismatchNote([], counts)).toBeNull();
    expect(mismatchNote([3, 2, 2], barCounts([0, 7, 14]))).toBeNull();
  });
});

describe('the custom builder', () => {
  it('stops at the engine limits', () => {
    expect(canAddGroup([4, 4, 4], 4)).toBe(true);
    const fullBar = Array.from({ length: KB_MAX_BEATS / 4 }, () => 4);
    expect(canAddGroup(fullBar, 1)).toBe(false);
    const full = Array.from({ length: KB_MAX_GRID_GROUPS }, () => 1);
    expect(canAddGroup(full, 1)).toBe(false);
  });

  it('says how far a grouping is from the bar', () => {
    const counts = barCounts([0, 7, 14, 20, 27]);
    expect(builderHint([3, 2], counts, 7)).toBe(
      'Add 2 more beats to fill a 7-beat bar. Until then every bar keeps only its first-beat accent.',
    );
    expect(builderHint([2, 2, 2], counts, 7)).toBe(
      "Fits the song's 6-beat bars (1 of 4). Its 7-beat bars keep only their first-beat accent.",
    );
    expect(builderHint([3, 2, 2], barCounts([0, 7, 14]), 7)).toBe(
      'Fits every bar in this song.',
    );
  });
});
