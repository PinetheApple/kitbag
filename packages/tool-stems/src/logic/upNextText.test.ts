import {
  ENTRY_KIND,
  UP_NEXT_SOURCE,
  type LibrarySongRow,
  type LibraryStemSetRow,
  type SetlistEntry,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  clearQueueBody,
  repeatedText,
  setlistRowSubtitle,
  upNextText,
} from './upNextText.ts';

const stem = (itemId: number, stemSetId: number) =>
  ({ kind: ENTRY_KIND.stem, item: { id: itemId }, stemSetId }) as SetlistEntry;
const click = (itemId: number, bpm: number | null = 72) =>
  ({
    kind: ENTRY_KIND.preset,
    item: { id: itemId },
    preset: {
      id: itemId,
      name: 'Ballad count',
      bpm,
      beatsPerBar: 6,
      denominator: 8,
    },
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
const hum = { kind: 'song', id: 9, title: 'Hum' } as LibrarySongRow;
const library = { stems, songs: new Map([[9, hum]]) };
const second = stem(2, 9);
const ballad = click(3);
const entries = [stem(1, 3), second, ballad, stem(4, 5), stem(5, 6)];
const context = {
  queueLength: 3,
  stage: { setlistId: 7, entries, skipped: [] },
  setlistName: 'Friday gig',
  library,
};

describe('up next row', () => {
  it('names a queued song and how many follow it', () => {
    const next = {
      source: UP_NEXT_SOURCE.queue,
      song: { kind: 'stems', id: 9 },
    } as const;
    expect(upNextText(next, context)).toEqual({
      title: 'Night Bus',
      source: 'Next in queue · 2 more after it',
      metronome: false,
    });
    expect(upNextText(next, { ...context, queueLength: 1 }).source).toBe(
      'Next in queue',
    );
  });

  it('names a queued single song by its own title', () => {
    const next = {
      source: UP_NEXT_SOURCE.queue,
      song: { kind: 'song', id: 9 },
    } as const;
    expect(upNextText(next, { ...context, queueLength: 1 })).toEqual({
      title: 'Hum',
      source: 'Next in queue',
      metronome: false,
    });
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
  it('reads a setlist row by kind, a metronome song by its own facts', () => {
    expect(setlistRowSubtitle(ballad, 'Friday gig', stems)).toBe(
      'Metronome song · 72 BPM · 6/8',
    );
    expect(setlistRowSubtitle(click(3, null), 'Friday gig', stems)).toBe(
      'Metronome song · 6/8',
    );
    expect(setlistRowSubtitle(second, 'Friday gig', stems)).toBe(
      'Friday gig · 3:52 · A maj · 104 BPM',
    );
  });

  it('says what Clear does, with and without a setlist on stage', () => {
    expect(clearQueueBody(3, 'Friday gig')).toBe(
      'The 3 queued songs leave the queue. Friday gig carries on after this song.',
    );
    expect(clearQueueBody(1, '')).toBe('The 1 queued song leaves the queue.');
  });
});

describe('up next row under Repeat one', () => {
  it('names the song on now as the one to play again', () => {
    expect(repeatedText({ kind: 'stems', id: 9 }, library, false)).toEqual({
      title: 'Night Bus',
      source: 'Plays again when this song ends',
      metronome: false,
    });
  });

  it('says it waits for the A-B loop to be cleared', () => {
    expect(repeatedText({ kind: 'song', id: 9 }, library, true)).toEqual({
      title: 'Hum',
      source: 'After the A-B loop is cleared',
      metronome: false,
    });
  });
});
