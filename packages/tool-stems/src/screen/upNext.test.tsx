import {
  configurePlayOrder,
  playOrderStore,
  songLibraryStore,
  type LibraryStemSetRow,
  type PlayOrderRepositories,
} from '@kitbag/core-state';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  flush,
  mountTracked,
  SET_ID,
  unmountTracked,
} from './playerHarness.test-helper.tsx';

const NIGHT_BUS = 21;
const TIN_ROOF = 22;
const MENU = 'Player menu';
const UP_NEXT_ROW = 'Up next: Night Bus, Queued · 1 more after it';

let queued: number[] = [];

function fakeQueue(): PlayOrderRepositories['queue'] {
  const entries = () =>
    queued.map((stemSetId, position) => ({
      id: stemSetId,
      stemSetId,
      position,
    }));
  const done = () => Promise.resolve();
  return {
    list: () => Promise.resolve(entries()),
    add: (stemSetId: number) => {
      if (!queued.includes(stemSetId)) queued.push(stemSetId);
      const position = queued.indexOf(stemSetId);
      return Promise.resolve({ id: stemSetId, stemSetId, position });
    },
    move: done,
    remove: (stemSetId: number) => {
      queued = queued.filter((id) => id !== stemSetId);
      return done();
    },
    takeThrough: (stemSetId: number) => {
      queued = queued.slice(queued.indexOf(stemSetId) + 1);
      return done();
    },
    clear: () => {
      queued = [];
      return done();
    },
  };
}

configurePlayOrder({ queue: fakeQueue() });

const song = (id: number, title: string): LibraryStemSetRow => ({
  kind: 'stems',
  id,
  title,
  artist: null,
  stemCount: 4,
  durationSec: 200,
  bpm: 100,
  key: null,
  scale: null,
  hasGrid: true,
  createdAt: new Date(0),
});

beforeEach(() => {
  queued = [];
  songLibraryStore.setState({
    rows: [song(NIGHT_BUS, 'Night Bus'), song(TIN_ROOF, 'Tin Roof')],
  });
});

afterEach(() => {
  unmountTracked();
});

async function withQueue(...ids: number[]) {
  queued = ids;
  const player = await mountTracked();
  await playOrderStore.getState().refresh();
  await flush();
  return player;
}

describe('Play next from the player', () => {
  it('queues the open song once and says so', async () => {
    const p = await mountTracked();
    await p.press(MENU);
    await p.press('Play next');
    await flush();
    expect(queued).toEqual([SET_ID]);
    expect(p.has('Added to Up next')).toBe(true);
    await p.press(MENU);
    expect(p.byLabel('In Up next').props.accessibilityState).toEqual({
      disabled: true,
    });
  });
});

describe('the Up next row', () => {
  it('shows only while something is up next', async () => {
    const p = await withQueue();
    expect(p.has('Up next')).toBe(false);
  });

  it('names the first queued song and skips to it, dropping it from the queue', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    expect(p.has('Night Bus')).toBe(true);
    expect(p.has('Queued · 1 more after it')).toBe(true);
    await p.press('Next: Night Bus');
    await flush();
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    expect(queued).toEqual([TIN_ROOF]);
  });
});

describe('the Up next sheet', () => {
  it('plays a queued row now, dropping the rows above it, once the sheet has closed', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    await p.press(UP_NEXT_ROW);
    let sheetShownAtLeave: boolean | undefined;
    p.routes.onOpenStemSet.mockImplementation(() => {
      sheetShownAtLeave = p.has('Queued');
    });
    await p.press('2. Tin Roof, queued. Plays it now');
    await flush();
    p.frames(0, 4);
    await flush();
    expect(queued).toEqual([]);
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(TIN_ROOF);
    expect(sheetShownAtLeave).toBe(false);
  });

  it('removes one queued song', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    await p.press(UP_NEXT_ROW);
    await p.press('Remove Night Bus from Up next');
    await flush();
    expect(queued).toEqual([TIN_ROOF]);
  });

  it('asks before clearing the queue', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    await p.press(UP_NEXT_ROW);
    await p.press('Clear queue');
    expect(queued).toEqual([NIGHT_BUS, TIN_ROOF]);
    expect(p.has('The 2 queued songs leave Up next.')).toBe(true);
    await p.press('Clear');
    await flush();
    expect(queued).toEqual([]);
  });
});
