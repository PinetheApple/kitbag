import { describe, expect, it } from 'vitest';

import { SONG_STEP } from '@kitbag/core-state';

import { entry } from './fixtures.test-helper.ts';
import {
  loadedSongName,
  notSavedMessage,
  nowRowA11yLabel,
  NO_ACTIVE_SET,
  NOT_IN_SETLIST,
  setlistChipA11yLabel,
  setlistChipLabel,
  soloChipA11yLabel,
  soloChipText,
  stageChipA11yLabel,
  stageChipText,
  stepA11yLabel,
  transportSubtitle,
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

describe('transportSubtitle', () => {
  const set = { id: 1, name: 'Wedding set', count: 3, position: 2 };

  it('names the set, the song and its position, as the notification design shows', () => {
    expect(transportSubtitle(set, 'Blackbird')).toBe(
      'Wedding set · Blackbird (2/3)',
    );
    expect(transportSubtitle({ ...set, position: 1 }, 'Intro')).toBe(
      'Wedding set · Intro (1/3)',
    );
  });

  it('falls back to the chip copy with no current song', () => {
    expect(transportSubtitle({ ...set, position: undefined }, undefined)).toBe(
      'Wedding set · 3 songs',
    );
    expect(transportSubtitle(set, undefined)).toBe(setlistChipLabel(set));
  });
});

describe('song chip', () => {
  const set = { id: 2, name: 'Test gig', count: 4, position: 2 };

  it('shows the song over the setlist and its position', () => {
    expect(stageChipText('Ballad in G', set)).toEqual({
      title: 'Ballad in G',
      context: 'Test gig · 2/4',
    });
    expect(stageChipA11yLabel('Ballad in G', set, false)).toBe(
      'Ballad in G, Setlist Test gig, song 2 of 4',
    );
  });

  it('says aloud that the song has unsaved changes', () => {
    expect(stageChipA11yLabel('Ballad in G', set, true)).toBe(
      'Ballad in G, unsaved changes, Setlist Test gig, song 2 of 4',
    );
    expect(soloChipA11yLabel('Ballad in G', true)).toBe(
      'Ballad in G, unsaved changes, not in a setlist',
    );
  });

  it('says the NOW row has unsaved changes', () => {
    expect(nowRowA11yLabel('2. Ballad in G, 139 BPM', true)).toBe(
      '2. Ballad in G, 139 BPM, now loaded, unsaved changes',
    );
    expect(nowRowA11yLabel('2. Ballad in G, 139 BPM', false)).toBe(
      '2. Ballad in G, 139 BPM, now loaded',
    );
  });

  it('names the song whose changes were dropped', () => {
    expect(notSavedMessage('Ballad in G')).toBe(
      'Changes to Ballad in G not saved',
    );
  });

  it('shows the setlist name when no song from the set is loaded', () => {
    const unplaced = { ...set, position: undefined };
    expect(stageChipText('Ballad in G', unplaced)).toEqual({
      title: 'Test gig',
      context: '4 songs',
    });
    expect(stageChipA11yLabel('Ballad in G', unplaced, true)).toBe(
      'Setlist Test gig, 4 songs',
    );
  });

  it('says a song loaded on its own is not in a setlist', () => {
    expect(soloChipText('Ballad in G')).toEqual({
      title: 'Ballad in G',
      context: NOT_IN_SETLIST,
    });
    expect(soloChipA11yLabel('Ballad in G', false)).toBe(
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
