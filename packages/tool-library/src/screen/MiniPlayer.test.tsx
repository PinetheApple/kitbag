// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SONG_ID = 7;
const SET_ID = 11;
const QUEUED_ID = 12;
const GIG_ID = 3;
const ITEM_ID = 31;

const players = vi.hoisted(() => ({
  song: {},
  stem: {},
  library: {},
  stage: {},
  next: undefined as
    { source: string; song: { kind: string; id: number } } | undefined,
  spot: null as { setlistName: string; number: number; of: number } | null,
  upNextCount: 0,
  togglePlay: vi.fn(),
  stopSongAndSession: vi.fn(),
}));

vi.mock('react-native', () => ({ View: 'View' }));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  MiniPlayerBar: 'MiniPlayerBar',
}));

vi.mock('@kitbag/core-state', async (original) => {
  const actual = await original<typeof import('@kitbag/core-state')>();
  return {
    ...actual,
    useShownSongId: () =>
      actual.songShown(players.song as never)
        ? (players.song as { songId: number }).songId
        : null,
    useShownStemSetId: () =>
      actual.stemShown(players.stem as never)
        ? (players.stem as { setId: number }).setId
        : null,
    useSetlistSpot: () => players.spot,
    useUpNextCount: () => players.upNextCount,
    loopEndFrames: () => null,
    stopSongAndSession: players.stopSongAndSession,
    useSongPlayer: (select: (state: unknown) => unknown) =>
      select(players.song),
    useStemPlayer: (select: (state: unknown) => unknown) =>
      select(players.stem),
    useLibrary: (select: (state: unknown) => unknown) =>
      select(players.library),
    useStage: () => players.stage,
    useUpNext: () => players.next,
    useStemSongs: () =>
      new Map([[QUEUED_ID, { id: QUEUED_ID, title: 'King of Kings' }]]),
    useLibrarySongs: () => ({
      stems: new Map([[QUEUED_ID, { id: QUEUED_ID, title: 'King of Kings' }]]),
      songs: new Map(),
    }),
  };
});

const { MiniPlayer, useMiniPlayerShown } = await import('./MiniPlayer.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const frame = { progress: { value: 0.4 }, playing: { value: 1 } };
const usePlayhead = vi.fn(() => frame as never);
const onOpenSong = vi.fn();
const onOpenStemSet = vi.fn();
const onOpenQueue = vi.fn();
const props = {
  usePlayhead,
  onOpenSong,
  onOpenStemSet,
  onOpenQueue,
  bottomInset: 0,
};
const closed = { status: 'idle', songId: null, setId: null };
const noStage = {
  stage: { setlistId: null, entries: [] },
  cursor: null,
  name: '',
};

function givenSong(change: Record<string, unknown> = {}) {
  players.song = {
    status: 'ready',
    songId: SONG_ID,
    title: 'Everlong',
    artist: 'Foo Fighters',
    click: true,
    speed: 1,
    engineRate: 48_000,
    durationFrames: 480_000,
    togglePlay: players.togglePlay,
    ...change,
  };
}

function givenStemSong(change: Record<string, unknown> = {}) {
  players.song = closed;
  players.stem = {
    status: 'ready',
    setId: SET_ID,
    title: 'Echo',
    artist: 'Charity Gayle',
    engineRate: 44_100,
    durationFrames: 441_000,
    advancedTo: null,
    togglePlay: players.togglePlay,
    ...change,
  };
}

function fromGig(entries: number) {
  players.library = {
    loaded: {
      presetId: null,
      stemSetId: SET_ID,
      itemId: ITEM_ID,
      setlistId: GIG_ID,
    },
  };
  players.stage = {
    stage: { setlistId: GIG_ID, entries: Array.from({ length: entries }) },
    cursor: { setlistId: GIG_ID, itemId: ITEM_ID, index: 1 },
    name: 'Sunday worship',
  };
  players.spot = { setlistName: 'Sunday worship', number: 2, of: entries };
}

function mount(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(createElement(MiniPlayer, props));
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

function bar(tree: ReactTestRenderer) {
  return tree.root.findByType('MiniPlayerBar' as never).props as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  players.stem = closed;
  players.library = { loaded: null };
  players.stage = noStage;
  players.next = undefined;
  players.spot = null;
  players.upNextCount = 0;
  givenSong();
});

describe('the mini-player', () => {
  it.each([
    ['no song is open', { status: 'idle', songId: null }],
    ['the song is still opening', { status: 'loading' }],
    ['the song failed', { status: 'failed' }],
  ])('draws nothing when %s', (_, change) => {
    givenSong(change);
    expect(mount().toJSON()).toBeNull();
    expect(usePlayhead).not.toHaveBeenCalled();
  });

  it('shows the title, the artist and the click state', () => {
    expect(bar(mount())).toMatchObject({
      tile: 'song',
      title: 'Everlong',
      detail: 'Foo Fighters · Click on',
    });
  });

  it('adds the speed while the song is slowed', () => {
    givenSong({ speed: 0.9 });
    expect(bar(mount()).detail).toBe('Foo Fighters · Click on · 90%');
  });

  it('draws the engine playhead, never a store copy', () => {
    const shown = bar(mount());
    expect(usePlayhead).toHaveBeenCalledWith(48_000, 480_000, null);
    expect(shown.progress).toBe(frame.progress);
    expect(shown.playing).toBe(frame.playing);
  });

  it('plays and pauses the song', () => {
    (bar(mount()).onTogglePlay as () => void)();
    expect(players.togglePlay).toHaveBeenCalledOnce();
  });

  it('ends the listening session from its close key', () => {
    (bar(mount()).onClose as () => void)();
    expect(players.stopSongAndSession).toHaveBeenCalledOnce();
  });

  it('goes away when the session closes', () => {
    const tree = mount();
    givenSong({ status: 'idle', songId: null });
    act(() => {
      tree.update(createElement(MiniPlayer, props));
    });
    expect(tree.toJSON()).toBeNull();
  });

  it('opens the queue from its Queue key, named with the count up next', () => {
    players.upNextCount = 3;
    const shown = bar(mount());
    expect(shown.queueLabel).toBe('Queue, 3 up next');
    (shown.onQueue as () => void)();
    expect(onOpenQueue).toHaveBeenCalledOnce();
    expect(onOpenSong).not.toHaveBeenCalled();
  });

  it('opens the player on a tap', () => {
    (bar(mount()).onOpen as () => void)();
    expect(onOpenSong).toHaveBeenCalledExactlyOnceWith(SONG_ID);
  });
});

describe('the mini-player for a stem song', () => {
  it('shows the stem song with a stem tile and the artist alone', () => {
    givenStemSong();
    expect(bar(mount())).toMatchObject({
      tile: 'stems',
      title: 'Echo',
      detail: 'Charity Gayle',
    });
    expect(usePlayhead).toHaveBeenCalledWith(44_100, 441_000, null);
  });

  it('names the song up next', () => {
    givenStemSong();
    players.next = {
      source: 'queue',
      song: { kind: 'stems', id: QUEUED_ID },
    };
    expect(bar(mount()).detail).toBe('Charity Gayle · Next: King of Kings');
  });

  it('says where a setlist song sits in its setlist', () => {
    givenStemSong();
    fromGig(5);
    players.next = {
      source: 'queue',
      song: { kind: 'stems', id: QUEUED_ID },
    };
    expect(bar(mount()).detail).toBe('Charity Gayle · Sunday worship · 2 of 5');
  });

  it('returns to the stem player on a tap', () => {
    givenStemSong();
    (bar(mount()).onOpen as () => void)();
    expect(onOpenStemSet).toHaveBeenCalledExactlyOnceWith(SET_ID);
    expect(onOpenSong).not.toHaveBeenCalled();
  });

  it('plays and pauses the stem song', () => {
    givenStemSong();
    (bar(mount()).onTogglePlay as () => void)();
    expect(players.togglePlay).toHaveBeenCalledOnce();
  });

  it('ends the listening session from its close key', () => {
    givenStemSong();
    (bar(mount()).onClose as () => void)();
    expect(players.stopSongAndSession).toHaveBeenCalledOnce();
  });

  it('stays up, named for the arriving song, while an advance loads it', () => {
    givenStemSong({
      status: 'loading',
      setId: QUEUED_ID,
      advancedTo: QUEUED_ID,
      title: '',
      artist: null,
    });
    expect(bar(mount()).title).toBe('King of Kings');
  });

  it('draws nothing while the stem song is still opening', () => {
    givenStemSong({ status: 'loading' });
    expect(mount().toJSON()).toBeNull();
  });
});

describe('whether a screen docks the mini-player', () => {
  function shown() {
    let value: boolean | undefined;
    const Probe = () => {
      value = useMiniPlayerShown();
      return null;
    };
    act(() => {
      create(createElement(Probe));
    });
    return value;
  }

  it.each([
    ['ready', true],
    ['loading', false],
    ['failed', false],
    ['missing', false],
    ['idle', false],
  ])('a %s song: %s', (status, expected) => {
    givenSong({ status });
    expect(shown()).toBe(expected);
  });

  it.each([
    ['ready', true],
    ['loading', false],
    ['idle', false],
  ])('a %s stem song: %s', (status, expected) => {
    givenStemSong({ status });
    expect(shown()).toBe(expected);
  });

  it('a stem song an advance is loading: true', () => {
    givenStemSong({ status: 'loading', advancedTo: SET_ID });
    expect(shown()).toBe(true);
  });
});
