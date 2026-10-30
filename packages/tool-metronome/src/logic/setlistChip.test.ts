import { describe, expect, it } from 'vitest';

import { SONG_STEP } from '@kitbag/core-state';

import { entry, summary } from './fixtures.test-helper.ts';
import {
  activeSetView,
  loadedSongName,
  NO_ACTIVE_SET,
  NOT_IN_SETLIST,
  setlistChipA11yLabel,
  setlistChipLabel,
  soloChipA11yLabel,
  soloChipText,
  stageChipA11yLabel,
  stageChipText,
  stepA11yLabel,
} from './setlistChip.ts';

const loadedFrom = (setlistId: number | null, itemId: number | null) => ({
  presetId: 1,
  itemId,
  setlistId,
});

describe('setlist chip', () => {
  it('shows the active set and the loaded song position', () => {
    const set = { id: 1, name: 'Wedding set', count: 12, position: 3 };
    expect(setlistChipLabel(set)).toBe('Wedding set · 3/12');
    expect(setlistChipA11yLabel(set)).toBe('Setlist Wedding set, song 3 of 12');
  });

  it('shows the song count when no song from the set is loaded', () => {
    const set = { id: 1, name: 'Gig', count: 1, position: undefined };
    expect(setlistChipLabel(set)).toBe('Gig · 1 song');
  });

  it('claims no set when none is active', () => {
    expect(setlistChipLabel(undefined)).toBe(NO_ACTIVE_SET);
    expect(setlistChipA11yLabel(undefined)).toBe('Setlists, none active');
  });
});

describe('activeSetView', () => {
  const setlists = [
    summary(1, 'Practice', false, 2),
    summary(2, 'Wedding set', true, 3),
  ];
  const entries = {
    1: [entry(10), entry(11)],
    2: [entry(20), entry(21), entry(22)],
  };

  it('places the loaded song inside the active set', () => {
    expect(activeSetView(setlists, entries, loadedFrom(2, 22))).toEqual({
      id: 2,
      name: 'Wedding set',
      count: 3,
      position: 3,
    });
  });

  it('places a song listed twice by its setlist item', () => {
    const twice = {
      2: [entry(20, 'A', 120, 7), entry(21), entry(22, 'A', 120, 7)],
    };
    expect(activeSetView(setlists, twice, loadedFrom(2, 22))?.position).toBe(3);
  });

  it('is on stage with no position when nothing or a removed song is loaded', () => {
    expect(activeSetView(setlists, entries, null)?.position).toBeUndefined();
    const removed = activeSetView(setlists, entries, loadedFrom(2, 99));
    expect(removed).toMatchObject({ id: 2, position: undefined });
  });

  it('is off stage while a song from outside the set is loaded', () => {
    expect(
      activeSetView(setlists, entries, loadedFrom(null, null)),
    ).toBeUndefined();
    expect(activeSetView(setlists, entries, loadedFrom(1, 10))).toBeUndefined();
  });

  it('is empty when no set is active', () => {
    expect(
      activeSetView(
        [summary(1, 'Practice', false, 2)],
        entries,
        loadedFrom(1, 10),
      ),
    ).toBeUndefined();
  });
});

describe('song chip', () => {
  const set = { id: 2, name: 'Test gig', count: 4, position: 2 };

  it('shows the song over the setlist and its position', () => {
    expect(stageChipText('Ballad in G', set)).toEqual({
      title: 'Ballad in G',
      context: 'Test gig · 2/4',
    });
    expect(stageChipA11yLabel('Ballad in G', set)).toBe(
      'Ballad in G, Setlist Test gig, song 2 of 4',
    );
  });

  it('shows the setlist name when no song from the set is loaded', () => {
    const unplaced = { ...set, position: undefined };
    expect(stageChipText('Ballad in G', unplaced)).toEqual({
      title: 'Test gig',
      context: '4 songs',
    });
    expect(stageChipA11yLabel('Ballad in G', unplaced)).toBe(
      'Setlist Test gig, 4 songs',
    );
  });

  it('says a song loaded on its own is not in a setlist', () => {
    expect(soloChipText('Ballad in G')).toEqual({
      title: 'Ballad in G',
      context: NOT_IN_SETLIST,
    });
    expect(soloChipA11yLabel('Ballad in G')).toBe(
      'Ballad in G, not in a setlist',
    );
  });

  it('has nothing to show with no song and no setlist', () => {
    expect(soloChipText(undefined)).toBeUndefined();
  });

  it('names the song a step would load', () => {
    expect(stepA11yLabel(SONG_STEP.next, entry(1, 'Shuffle'))).toBe(
      'Next song, Shuffle',
    );
    expect(stepA11yLabel(SONG_STEP.previous, undefined)).toBe('Previous song');
  });
});

describe('loadedSongName', () => {
  const presets = [{ id: 1, name: 'Ballad in G' }] as unknown as Parameters<
    typeof loadedSongName
  >[0];

  it('names the loaded song for the chip', () => {
    expect(loadedSongName(presets, loadedFrom(null, null))).toBe('Ballad in G');
  });

  it('leaves the chip with no song once the song is cleared', () => {
    expect(soloChipText(loadedSongName(presets, null))).toBeUndefined();
  });
});
