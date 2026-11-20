import type { QueuedSong } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import type { HeardSong } from '../library/setlistSession.ts';
import { ENTRY_KIND, type SetlistEntry } from '../library/snapshot.ts';
import { cursorAt, type OnStage } from './order.ts';
import { BACK, backOf, heardOf } from './previous.ts';

const SETLIST_ID = 5;
const NIGHT_BUS: QueuedSong = { kind: 'stems', id: 21 };
const TIN_ROOF: QueuedSong = { kind: 'stems', id: 22 };
const HUM: QueuedSong = { kind: 'song', id: 41 };

const stem = (itemId: number, stemSetId: number) =>
  ({
    kind: ENTRY_KIND.stem,
    item: { id: itemId },
    stemSetId,
  }) as unknown as SetlistEntry;
const metronome = (itemId: number) =>
  ({
    kind: ENTRY_KIND.preset,
    item: { id: itemId },
    preset: { id: itemId },
  }) as unknown as SetlistEntry;

const gig: OnStage = {
  setlistId: SETLIST_ID,
  entries: [metronome(1), stem(2, NIGHT_BUS.id), stem(3, TIN_ROOF.id)],
  skipped: [],
};
const alone: OnStage = { setlistId: null, entries: [], skipped: [] };

const plain = (song: QueuedSong): HeardSong => ({ song, setlistItemId: null });
const fromGig = (song: QueuedSong, itemId: number): HeardSong => ({
  song,
  setlistItemId: itemId,
});

describe('going back an entry', () => {
  it('goes from a single song to the stem song heard before it, queueing the one left first', () => {
    const back = backOf({
      heard: [plain(NIGHT_BUS), plain(HUM)],
      current: plain(HUM),
      stage: alone,
      cursor: null,
    });
    expect(back).toEqual({
      kind: BACK.song,
      song: NIGHT_BUS,
      left: HUM,
      requeue: HUM,
    });
  });

  it('steps the setlist back to the entry heard before, leaving the queue alone', () => {
    const back = backOf({
      heard: [fromGig(NIGHT_BUS, 2), fromGig(TIN_ROOF, 3)],
      current: fromGig(TIN_ROOF, 3),
      stage: gig,
      cursor: cursorAt(gig, 3),
    });
    expect(back).toEqual({
      kind: BACK.setlist,
      entry: gig.entries[1],
      left: TIN_ROOF,
      requeue: null,
    });
  });

  it('queues a setlist song it leaves for a song from outside the setlist', () => {
    const back = backOf({
      heard: [plain(HUM), fromGig(TIN_ROOF, 3)],
      current: fromGig(TIN_ROOF, 3),
      stage: gig,
      cursor: cursorAt(gig, 3),
    });
    expect(back).toMatchObject({ kind: BACK.song, song: HUM, requeue: TIN_ROOF });
  });

  it('with nothing heard before, goes to the setlist entry before, a metronome song included', () => {
    const back = backOf({
      heard: [fromGig(NIGHT_BUS, 2)],
      current: fromGig(NIGHT_BUS, 2),
      stage: gig,
      cursor: cursorAt(gig, 2),
    });
    expect(back).toMatchObject({ kind: BACK.setlist, entry: gig.entries[0] });
  });

  it('has nowhere to go from the first song heard outside a setlist', () => {
    expect(
      backOf({ heard: [plain(HUM)], current: plain(HUM), stage: alone, cursor: null }),
    ).toBeNull();
  });

  it('plays a song heard from a setlist since left as a song of its own', () => {
    const back = backOf({
      heard: [fromGig(NIGHT_BUS, 2), plain(HUM)],
      current: plain(HUM),
      stage: alone,
      cursor: null,
    });
    expect(back).toMatchObject({ kind: BACK.song, song: NIGHT_BUS });
  });
});

describe('what counts as heard from a setlist', () => {
  it('marks a stem song loaded from the setlist with its entry', () => {
    const loaded = {
      presetId: null,
      stemSetId: NIGHT_BUS.id,
      itemId: 2,
      setlistId: SETLIST_ID,
      index: 1,
    };
    expect(heardOf(NIGHT_BUS, loaded)).toEqual(fromGig(NIGHT_BUS, 2));
    expect(heardOf(TIN_ROOF, loaded)).toEqual(plain(TIN_ROOF));
    expect(heardOf(HUM, null)).toEqual(plain(HUM));
  });
});
