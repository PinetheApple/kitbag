import {
  configurePlayOrder,
  ENTRY_KIND,
  libraryStore,
  metronomeStore,
  playOrderStore,
  SKIPPED_STEM_SONG,
  songLibraryStore,
  type LibraryStemSetRow,
  type PlayOrderRepositories,
} from '@kitbag/core-state';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  flush,
  mountTracked,
  SET_ID,
  unmountTracked,
} from './playerHarness.test-helper.tsx';

const NIGHT_BUS = 21;
const GIG = 5;
const BALLAD_ITEM = 31;
const BALLAD_PRESET = 41;
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

const libraryBefore = libraryStore.getState();

afterEach(() => {
  unmountTracked();
  libraryStore.setState(libraryBefore, true);
  vi.restoreAllMocks();
});

function metronomeEntryOnStage() {
  const loadSong = vi.fn(() => Promise.resolve());
  libraryStore.setState({
    setlists: [
      {
        setlist: { id: GIG, name: 'Gig', active: true },
        songCount: 1,
        rampCount: 0,
      },
    ] as never,
    entries: {
      [GIG]: [
        {
          kind: ENTRY_KIND.preset,
          item: { id: BALLAD_ITEM },
          preset: { id: BALLAD_PRESET, name: 'Ballad', bpm: 72 },
        },
      ] as never,
    },
    refresh: () => Promise.resolve(),
    loadSong,
  });
  const start = vi.spyOn(metronomeStore.getState(), 'start');
  return { loadSong, start };
}

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

function holdAnimationFrames() {
  const held: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) =>
    held.push(frame),
  );
  const drain = () => {
    vi.unstubAllGlobals();
    for (const frame of held.splice(0)) frame(0);
  };
  return { drain };
}

describe('Add to setlist from the player', () => {
  it('says where the song went only once the sheet has closed', async () => {
    const addStemToSetlist = vi.fn(() => Promise.resolve());
    libraryStore.setState({
      setlists: [
        {
          setlist: { id: GIG, name: 'Gig', active: false },
          songCount: 0,
          rampCount: 0,
        },
      ] as never,
      entries: { [GIG]: [] },
      refresh: () => Promise.resolve(),
      addStemToSetlist,
    });
    const p = await mountTracked();
    await p.press(MENU);
    await p.press('Add to setlist');
    const frames = holdAnimationFrames();
    const gig = p.renderer.root.find(
      (node) =>
        typeof node.type === 'string' &&
        String(node.props.accessibilityLabel).startsWith('Gig'),
    );
    await act(async () => {
      (gig.props.onPress as () => void)();
      await Promise.resolve();
    });
    await flush();
    expect(addStemToSetlist).toHaveBeenCalledWith(GIG, SET_ID);
    expect(p.has('Added to Gig')).toBe(false);
    act(frames.drain);
    await flush();
    expect(p.has('Added to Gig')).toBe(true);
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

describe('a metronome entry up next', () => {
  it('opens in the metronome from the Up next row without starting the click', async () => {
    const { loadSong, start } = metronomeEntryOnStage();
    const p = await withQueue();
    await p.press('Open');
    await flush();
    expect(loadSong).toHaveBeenCalledWith(BALLAD_PRESET, BALLAD_ITEM, GIG);
    expect(p.routes.onOpenMetronome).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it('opens in the metronome from the Up next sheet without starting the click', async () => {
    const { loadSong, start } = metronomeEntryOnStage();
    const p = await withQueue();
    await p.press('Up next: Ballad, Gig · 1 of 1 · metronome');
    await p.press('Ballad, from Gig');
    await flush();
    p.frames(0, 4);
    await flush();
    expect(loadSong).toHaveBeenCalledWith(BALLAD_PRESET, BALLAD_ITEM, GIG);
    expect(p.routes.onOpenMetronome).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });
});

describe('opening the next song', () => {
  it('releases the open song and opens the new one paused when the route moves on', async () => {
    const p = await withQueue(NIGHT_BUS);
    await p.press('Next: Night Bus');
    await flush();
    await p.showSet(NIGHT_BUS);
    expect(
      (p.records.readStemSet.mock.calls as unknown[][]).map((call) => call[0]),
    ).toEqual([SET_ID, NIGHT_BUS]);
    expect(p.store.getState().setId).toBe(NIGHT_BUS);
    expect(p.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('opens the song again when the next one is the song already open', async () => {
    songLibraryStore.setState({ rows: [song(SET_ID, 'Open song')] });
    const p = await withQueue(SET_ID);
    await p.press('Next: Open song');
    await flush();
    expect(p.routes.onOpenStemSet).not.toHaveBeenCalled();
    expect(p.records.readStemSet).toHaveBeenCalledTimes(2);
    expect(p.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('shows a skip carried from the metronome', async () => {
    libraryStore.getState().carrySkip(true);
    const p = await mountTracked();
    expect(p.has(SKIPPED_STEM_SONG)).toBe(true);
    expect(libraryStore.getState().carriedSkip).toBe(false);
  });
});
