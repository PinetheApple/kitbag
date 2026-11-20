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
import { Sheet, Snackbar } from '@kitbag/core-design';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpeedKeySheet } from './SpeedKeySheet.tsx';
import {
  flush,
  mountTracked,
  SET_ID,
  unmountTracked,
  type Player,
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

const BALLAD_UP_NEXT = 'Up next: Ballad, Gig · 1 of 1 · metronome';
const NIGHT_BUS_UP_NEXT = 'Up next: Night Bus, Queued';

function metronomeEntryOnStage() {
  const loadSong = vi.fn(() => Promise.resolve());
  libraryStore.setState({
    session: { setlistId: GIG, skipped: [] },
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

function oneSetlist(addStemToSetlist: () => Promise<void>): void {
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
}

async function pickGig(p: Player): Promise<void> {
  const gig = p.renderer.root.find(
    (node) =>
      typeof node.type === 'string' &&
      String(node.props.accessibilityLabel).startsWith('Gig'),
  );
  await act(async () => {
    (gig.props.onPress as () => void)();
    await Promise.resolve();
  });
}

describe('Add to setlist from the player', () => {
  it('says where the song went only once the sheet has closed', async () => {
    const addStemToSetlist = vi.fn(() => Promise.resolve());
    oneSetlist(addStemToSetlist);
    const p = await mountTracked();
    await p.press(MENU);
    await p.press('Add to setlist');
    const frames = holdAnimationFrames();
    await pickGig(p);
    await flush();
    expect(addStemToSetlist).toHaveBeenCalledWith(GIG, SET_ID);
    expect(p.has('Added to Gig')).toBe(false);
    act(frames.drain);
    await flush();
    expect(p.has('Added to Gig')).toBe(true);
  });

  it('says it once when the sheet closes before the add lands, and not on the next close', async () => {
    const add = Promise.withResolvers<undefined>();
    oneSetlist(() => add.promise);
    const p = await mountTracked();
    await p.press(MENU);
    await p.press('Add to setlist');
    await pickGig(p);
    await p.press('Cancel');
    await flush();
    await act(async () => {
      add.resolve(undefined);
      await Promise.resolve();
    });
    await flush();
    expect(p.has('Added to Gig')).toBe(true);
    await p.press('Open');
    expect(p.routes.onOpenSetlist).toHaveBeenCalledOnce();
    const snack = p.renderer.root.find((node) => node.type === Snackbar);
    act(snack.props.onTimeout as () => void);
    expect(p.has('Added to Gig')).toBe(false);
    await p.press(MENU);
    await p.press('Add to setlist');
    await p.press('Cancel');
    await flush();
    expect(p.has('Added to Gig')).toBe(false);
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
    await p.press(BALLAD_UP_NEXT);
    await p.press('Ballad, from Gig');
    await flush();
    p.frames(0, 4);
    await flush();
    expect(loadSong).toHaveBeenCalledWith(BALLAD_PRESET, BALLAD_ITEM, GIG);
    expect(p.routes.onOpenMetronome).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });
});

describe('the setlist part of Up next', () => {
  it('is absent for a setlist pinned before this session started', async () => {
    metronomeEntryOnStage();
    libraryStore.setState({ session: null });
    const p = await withQueue();
    expect(p.has('Up next')).toBe(false);
  });

  it('skips an entry this time from the sheet', async () => {
    metronomeEntryOnStage();
    const p = await withQueue(NIGHT_BUS);
    await p.press(NIGHT_BUS_UP_NEXT);
    await p.press('Skip Ballad this time');
    await flush();
    expect(libraryStore.getState().session?.skipped).toEqual([BALLAD_ITEM]);
    expect(p.has('Ballad, from Gig')).toBe(false);
  });

  it('leaves the setlist from the sheet, and Undo rejoins it', async () => {
    metronomeEntryOnStage();
    const left = {
      setlistId: GIG,
      setlistName: 'Gig',
      restores: {
        session: { setlistId: GIG, skipped: [] },
        loaded: null,
        played: [],
        discarded: null,
      },
      leftAs: { session: null, loaded: null },
    };
    const leaveSetlist = vi.fn(() => {
      libraryStore.setState({ session: null });
      return Promise.resolve(left);
    });
    const rejoinSetlist = vi.fn(() => Promise.resolve(true));
    libraryStore.setState({ leaveSetlist, rejoinSetlist });
    const p = await withQueue();
    await p.press(BALLAD_UP_NEXT);
    await p.press('Leave setlist');
    await flush();
    expect(leaveSetlist).toHaveBeenCalledOnce();
    expect(p.has('Left Gig')).toBe(true);
    await p.press('Undo');
    expect(rejoinSetlist).toHaveBeenCalledWith(left);
  });

  it('offers Leave setlist while the setlist is running, even with nothing after this song', async () => {
    metronomeEntryOnStage();
    libraryStore.getState().skipSetlistEntry(BALLAD_ITEM);
    const p = await withQueue(NIGHT_BUS);
    await p.press(NIGHT_BUS_UP_NEXT);
    expect(p.has('Ballad, from Gig')).toBe(false);
    expect(p.has('Leave setlist')).toBe(true);
  });

  it('says which setlist a list start ended, with Undo', async () => {
    metronomeEntryOnStage();
    const rejoinSetlist = vi.fn(() => Promise.resolve(true));
    libraryStore.setState({ rejoinSetlist });
    libraryStore.getState().endSetlistSession();
    const p = await withQueue();
    expect(p.has('Left Gig')).toBe(true);
    expect(libraryStore.getState().endedSetlist).toBeNull();
    await p.press('Undo');
    expect(rejoinSetlist).toHaveBeenCalledOnce();
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

  it('shows no sheet once the open song opens again', async () => {
    songLibraryStore.setState({ rows: [song(SET_ID, 'Open song')] });
    const p = await withQueue(SET_ID);
    const speed = p.byLabel('Speed').props.onAccessibilityAction as (
      event: unknown,
    ) => void;
    await act(async () => {
      speed({ nativeEvent: { actionName: 'activate' } });
      await flush();
    });
    expect(p.renderer.root.findByType(SpeedKeySheet).props.visible).toBe(true);
    await p.press('Next: Open song');
    await flush();
    expect(p.records.readStemSet).toHaveBeenCalledTimes(2);
    const shown = p.renderer.root
      .findAllByType(Sheet)
      .filter((sheet) => sheet.props.visible === true);
    expect(shown).toHaveLength(0);
  });

  it('shows a skip carried from the metronome', async () => {
    libraryStore.getState().carrySkip(true);
    const p = await mountTracked();
    expect(p.has(SKIPPED_STEM_SONG)).toBe(true);
    expect(libraryStore.getState().carriedSkip).toBe(false);
  });
});
