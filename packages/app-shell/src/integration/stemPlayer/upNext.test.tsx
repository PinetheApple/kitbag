import {
  autoAdvanceDeps,
  configurePlayOrder,
  libraryStore,
  SKIPPED_STEM_SONG,
  songLibraryStore,
  songPlayerStore,
  startAutoAdvance,
  stopSongsForMetronome,
} from '@kitbag/core-state';
import {
  playerWaveBars,
  QUEUE_TEXT,
  Snackbar,
  SwipeDeleteRow,
} from '@kitbag/core-design';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BALLAD_ITEM,
  BALLAD_PRESET,
  fakeQueue,
  GIG,
  HUM,
  hum,
  metronomeEntryOnStage,
  queued,
  setQueued,
  single,
  stemRow,
  stems,
  withQueue,
} from './playQueue.test-helper.ts';
import {
  flush,
  mountTracked,
  SET_ID,
  unmountTracked,
  type Player,
} from './playerHarness.test-helper.tsx';
import { UP_NEXT } from '@/listening/UpNextRow.tsx';

const NIGHT_BUS = 21;
const TIN_ROOF = 22;
const MENU = 'Player menu';
const UP_NEXT_ROW = 'Up next: Night Bus, Next in queue · 1 more after it';
const QUEUE_KEY = 'Queue, 2 up next';

configurePlayOrder({ queue: fakeQueue() });
startAutoAdvance(autoAdvanceDeps(playerWaveBars));

beforeEach(() => {
  setQueued([]);
  songLibraryStore.setState({
    rows: [stemRow(NIGHT_BUS, 'Night Bus'), stemRow(TIN_ROOF, 'Tin Roof'), hum],
  });
});

const libraryBefore = libraryStore.getState();

afterEach(() => {
  unmountTracked();
  libraryStore.setState(libraryBefore, true);
  vi.restoreAllMocks();
});

const BALLAD_UP_NEXT = 'Up next: Ballad, Gig · 1 of 1 · metronome';
const NIGHT_BUS_UP_NEXT = 'Up next: Night Bus, Next in queue';

describe('Play next and Add to queue from the player', () => {
  it('puts the open song first on Play next and says so', async () => {
    const p = await withQueue(NIGHT_BUS);
    const { title } = p.store.getState();
    await p.press(MENU);
    await p.press('Play next');
    await flush();
    expect(queued).toEqual([stems(SET_ID), stems(NIGHT_BUS)]);
    expect(p.has(`${title} plays next`)).toBe(true);
  });

  it('puts the open song last on Add to queue, and Open shows the queue', async () => {
    const p = await withQueue(NIGHT_BUS);
    const { title } = p.store.getState();
    await p.press(MENU);
    await p.press('Add to queue');
    await flush();
    expect(queued).toEqual([stems(NIGHT_BUS), stems(SET_ID)]);
    expect(p.has(`Added to queue: ${title}`)).toBe(true);
    await p.press('Open');
    expect(p.has('Clear queue')).toBe(true);
  });

  it('offers Move to end of queue once the open song is queued', async () => {
    const p = await withQueue(SET_ID, NIGHT_BUS);
    await p.press(MENU);
    await p.press('Move to end of queue');
    await flush();
    expect(queued).toEqual([stems(NIGHT_BUS), stems(SET_ID)]);
    expect(p.has('Moved to end of queue')).toBe(true);
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

describe('a queued single song', () => {
  function handOverWatched(p: Player) {
    p.commands.songTransportHide.mockClear();
    return vi
      .spyOn(songPlayerStore.getState(), 'takeOver')
      .mockResolvedValue('playing');
  }

  function expectHandedOver(
    p: Player,
    takeOver: ReturnType<typeof handOverWatched>,
  ) {
    expect(takeOver).toHaveBeenCalledExactlyOnceWith(HUM, playerWaveBars.song);
    expect(p.store.getState().status).toBe('idle');
    expect(p.commands.songTransportHide).not.toHaveBeenCalled();
    expect(p.routes.onOpenSong).toHaveBeenCalledWith(HUM);
  }

  it('shows in the Up next row and Next hands over to the song player, card kept', async () => {
    const p = await withQueue(single(HUM), TIN_ROOF);
    expect(p.has('Hum')).toBe(true);
    const takeOver = handOverWatched(p);
    await p.press('Next: Hum');
    await flush();
    expectHandedOver(p, takeOver);
    expect(p.routes.onOpenStemSet).not.toHaveBeenCalled();
    expect(queued).toEqual([stems(TIN_ROOF)]);
  });

  it('hands over from its Up next sheet row once the sheet has closed', async () => {
    const p = await withQueue(NIGHT_BUS, single(HUM));
    await p.press(UP_NEXT_ROW);
    expect(p.has('3:20 · 90 BPM')).toBe(true);
    const takeOver = handOverWatched(p);
    await p.press('2. Hum, queued. Plays it now');
    await flush();
    p.frames(0, 4);
    await flush();
    expect(queued).toEqual([]);
    expectHandedOver(p, takeOver);
  });
});

describe('the queue sheet in the player', () => {
  it('plays a queued row now, dropping the rows above it, once the sheet has closed', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    await p.press(UP_NEXT_ROW);
    let sheetShownAtLeave: boolean | undefined;
    p.routes.onOpenStemSet.mockImplementation(() => {
      sheetShownAtLeave = p.has('Next in queue');
    });
    await p.press('2. Tin Roof, queued. Plays it now');
    await flush();
    p.frames(0, 4);
    await flush();
    expect(queued).toEqual([]);
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(TIN_ROOF);
    expect(sheetShownAtLeave).toBe(false);
    await p.showSet(TIN_ROOF);
    expect(p.store.getState().setId).toBe(TIN_ROOF);
    expect(p.commands.mixerPlay).toHaveBeenCalledOnce();
    expect(
      (p.records.readStemSet.mock.calls as unknown[][]).map((call) => call[0]),
    ).toEqual([SET_ID, TIN_ROOF]);
  });

  it('removes one queued song', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    await p.press(UP_NEXT_ROW);
    await p.press('Remove Night Bus from the queue');
    await flush();
    expect(queued).toEqual([stems(TIN_ROOF)]);
  });

  it('asks before clearing the queue', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    await p.press(UP_NEXT_ROW);
    await p.press('Clear queue');
    expect(queued).toEqual([stems(NIGHT_BUS), stems(TIN_ROOF)]);
    expect(p.has('The 2 queued songs leave the queue.')).toBe(true);
    await p.press('Clear');
    await flush();
    expect(queued).toEqual([]);
  });
});

describe('opening and editing the queue from the player', () => {
  it('opens from the Queue key in the app bar, named with the count', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    expect(p.has('Next in queue')).toBe(false);
    await p.press(QUEUE_KEY);
    expect(p.has('Next in queue')).toBe(true);
    expect(p.has('· 2 up next')).toBe(true);
  });

  it('names its sections Now playing, Next in queue and Next from the setlist', async () => {
    metronomeEntryOnStage();
    const p = await withQueue(NIGHT_BUS);
    await p.press(NIGHT_BUS_UP_NEXT);
    expect(p.has('Now playing')).toBe(true);
    expect(p.has('Next in queue')).toBe(true);
    expect(p.has('Next from: Gig')).toBe(true);
    expect(p.has('Queued')).toBe(false);
    expect(p.has('Then from Gig')).toBe(false);
  });

  it('reorders a queued song by its handle', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    await p.press(QUEUE_KEY);
    const handle = p.byLabel('Reorder, position 1 of 2');
    await act(async () => {
      (handle.props.onAccessibilityAction as (event: unknown) => void)({
        nativeEvent: { actionName: 'increment' },
      });
      await Promise.resolve();
    });
    await flush();
    expect(queued).toEqual([stems(TIN_ROOF), stems(NIGHT_BUS)]);
  });

  it('removes a queued song swiped away', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    await p.press(QUEUE_KEY);
    const [first] = p.renderer.root.findAllByType(SwipeDeleteRow);
    let removed: boolean | undefined;
    await act(async () => {
      removed = await (first?.props.onDelete as () => Promise<boolean>)();
    });
    expect(removed).toBe(true);
    expect(queued).toEqual([stems(TIN_ROOF)]);
  });

  it('says nothing is queued, with no count, when nothing is up next', async () => {
    const p = await withQueue();
    await p.press('Queue');
    expect(p.has('Nothing queued')).toBe(true);
    expect(p.has('Done')).toBe(true);
    expect(p.texts().some((text) => text.endsWith('up next'))).toBe(false);
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

  it('opens in the metronome from Open while loading it closes the stem player', async () => {
    const { loadSong, start } = metronomeEntryOnStage();
    loadSong.mockImplementation(() => {
      libraryStore.setState({
        songLoads: libraryStore.getState().songLoads + 1,
      });
      return Promise.resolve();
    });
    const stopTakeover = stopSongsForMetronome();
    const p = await withQueue();
    await p.press('Open');
    await flush();
    stopTakeover();
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
    expect(p.has('Ballad')).toBe(false);
    expect(p.has(UP_NEXT)).toBe(false);
    expect(p.labelled(QUEUE_TEXT.previous)).toHaveLength(1);
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
  it('plays the next stem song from Next, keeping the player through the route change', async () => {
    const p = await withQueue(NIGHT_BUS);
    await p.press('Next: Night Bus');
    await flush();
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    await p.showSet(NIGHT_BUS);
    expect(
      (p.records.readStemSet.mock.calls as unknown[][]).map((call) => call[0]),
    ).toEqual([SET_ID, NIGHT_BUS]);
    expect(p.store.getState().setId).toBe(NIGHT_BUS);
    expect(p.commands.mixerPlay).toHaveBeenCalledOnce();
    expect(queued).toEqual([]);
  });

  it('plays the open song again from the start when it is the next one', async () => {
    songLibraryStore.setState({ rows: [stemRow(SET_ID, 'Open song')] });
    const p = await withQueue(SET_ID);
    await p.press('Next: Open song');
    await flush();
    expect(p.routes.onOpenStemSet).not.toHaveBeenCalled();
    expect(p.records.readStemSet).toHaveBeenCalledTimes(2);
    expect(p.commands.mixerPlay).toHaveBeenCalledOnce();
  });

  it('shows a skip carried from the metronome', async () => {
    libraryStore.getState().carrySkip(true);
    const p = await mountTracked();
    expect(p.has(SKIPPED_STEM_SONG)).toBe(true);
    expect(libraryStore.getState().carriedSkip).toBe(false);
  });
});
