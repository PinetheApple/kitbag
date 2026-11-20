import {
  ENTRY_KIND,
  UP_NEXT_SOURCE,
  type LibraryStemSetRow,
  type SetlistEntry,
  type SetlistSummary,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  clearQueueBody,
  pickerSubtitle,
  setlistRowSubtitle,
  upNextText,
} from './upNextText.ts';

const stem = (itemId: number, stemSetId: number) =>
  ({ kind: ENTRY_KIND.stem, item: { id: itemId }, stemSetId }) as SetlistEntry;
const click = (itemId: number) =>
  ({
    kind: ENTRY_KIND.preset,
    item: { id: itemId },
    preset: { id: itemId, name: 'Ballad count', bpm: 72 },
  }) as unknown as SetlistEntry;
const nightBus = {
  kind: 'stems',
  id: 9,
  title: 'Night Bus',
  artist: 'The Pale Hours',
  durationSec: 232,
  bpm: 104,
  key: 'A',
  scale: 'major',
} as LibraryStemSetRow;
const stems = new Map([[9, nightBus]]);
const second = stem(2, 9);
const ballad = click(3);
const entries = [stem(1, 3), second, ballad, stem(4, 5), stem(5, 6)];
const context = {
  queueLength: 3,
  stage: { setlistId: 7, entries },
  setlistName: 'Friday gig',
  stems,
};

describe('up next row', () => {
  it('names a queued song and how many follow it', () => {
    const next = { source: UP_NEXT_SOURCE.queue, stemSetId: 9 } as const;
    expect(upNextText(next, context)).toEqual({
      title: 'Night Bus',
      source: 'Queued · 2 more after it',
      metronome: false,
    });
    expect(upNextText(next, { ...context, queueLength: 1 }).source).toBe(
      'Queued',
    );
  });

  it('places a setlist song in its set', () => {
    const next = { source: UP_NEXT_SOURCE.setlist, entry: second } as const;
    expect(upNextText(next, context)).toEqual({
      title: 'Night Bus',
      source: 'Friday gig · 2 of 5',
      metronome: false,
    });
  });

  it('marks a metronome song, which only opens', () => {
    const next = { source: UP_NEXT_SOURCE.setlist, entry: ballad } as const;
    expect(upNextText(next, context)).toEqual({
      title: 'Ballad count',
      source: 'Friday gig · 3 of 5 · metronome',
      metronome: true,
    });
  });
});

describe('up next sheet text', () => {
  it('reads a setlist row by kind', () => {
    expect(setlistRowSubtitle(ballad, 'Friday gig', stems)).toBe(
      'Friday gig · metronome · 72 BPM',
    );
    expect(setlistRowSubtitle(second, 'Friday gig', stems)).toBe(
      'Friday gig · 3:52 · A maj · 104 BPM',
    );
  });

  it('says what Clear does, with and without a setlist on stage', () => {
    expect(clearQueueBody(3, 'Friday gig')).toBe(
      'The 3 queued songs leave Up next. Friday gig carries on after this song.',
    );
    expect(clearQueueBody(1, '')).toBe('The 1 queued song leaves Up next.');
  });
});

describe('setlist picker row', () => {
  it('counts the songs, the stem songs among them, and whether it is on stage', () => {
    const summary = {
      setlist: { active: true },
      songCount: 5,
    } as SetlistSummary;
    expect(pickerSubtitle(summary, entries)).toBe(
      '5 songs · 4 stem songs · on stage',
    );
    const quiet = {
      setlist: { active: false },
      songCount: 1,
    } as SetlistSummary;
    expect(pickerSubtitle(quiet, [click(1)])).toBe('1 song');
  });
});
