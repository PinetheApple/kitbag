// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entry } from '../logic/fixtures.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const SETLIST_ID = 4;
const NIGHT_BUS = 9;

const fake = vi.hoisted(() => {
  const songMenu: Record<string, unknown> = { kind: 'none', target: null };
  return {
    entries: [] as unknown[],
    openStemEntry: vi.fn(() => Promise.resolve(true)),
    reorder: vi.fn(),
    loadSong: vi.fn(() => Promise.resolve()),
    start: vi.fn(),
    stop: vi.fn(),
    openSongActions: vi.fn(),
    songMenu,
    sheets: [] as Props[],
  };
});

vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('@kitbag/core-design', () => ({
  AppBar: 'AppBar',
  Badge: 'Badge',
  Card: 'Card',
  Chip: 'Chip',
  ChipRow: (props: Props) => props.children,
  DragListRow: 'DragListRow',
  EmptyState: 'EmptyState',
  SheetHint: 'SheetHint',
  countLabel: (n: number, one: string, many: string) =>
    `${String(n)} ${n === 1 ? one : many}`,
}));
vi.mock('@kitbag/core-state', () => ({
  ENTRY_KIND: { preset: 'preset', stem: 'stem' },
  STEMS_BADGE: 'STEMS',
  UNKNOWN_STEM_SONG: 'Stem song',
  isPresetEntry: (e: { kind: string }) => e.kind === 'preset',
  stemFacts: () => '3:52 · A maj · 104 BPM',
  stemSongTitle: (id: number) => (id === 9 ? 'Night Bus' : 'Stem song'),
  useStemSongs: () => new Map([[9, { id: 9, title: 'Night Bus' }]]),
  useLibrary: (select: (state: unknown) => unknown) =>
    select({
      ready: true,
      loaded: null,
      entries: { [SETLIST_ID]: fake.entries },
      setlists: [{ setlist: { id: SETLIST_ID, name: 'Gig' } }],
      reorder: fake.reorder,
      removeFromSet: vi.fn(),
      openStemEntry: fake.openStemEntry,
      loadSong: fake.loadSong,
    }),
  useMetronome: (select: (state: unknown) => unknown) =>
    select({ start: fake.start, stop: fake.stop }),
}));
vi.mock('../logic/songSummary.ts', () => ({
  setlistTitle: (name: string | undefined) => name ?? '',
  songSubtitle: () => '120 BPM',
}));
vi.mock('../screen/CustomSounds.tsx', () => ({
  useCustomSoundViews: () => [],
}));
vi.mock('./ScreenFrame.tsx', () => ({
  ScreenFrame: (props: Props) => props.children,
}));
vi.mock('./useLibraryRefresh.ts', () => ({
  useLibraryRefresh: () => undefined,
}));
vi.mock('./SongMenu.tsx', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongMenu: () => ({ ...fake.songMenu, openActions: fake.openSongActions }),
  SongMenuSheets: () => null,
}));
vi.mock('./DetailMenu.tsx', () => ({
  useDetailMenu: () => ({ openAdd: vi.fn(), openSave: vi.fn() }),
  DetailSheets: () => null,
}));
vi.mock('./sheets.tsx', () => ({
  ActionsSheet: (props: Props) => {
    fake.sheets.push(props);
    return null;
  },
  guarded: vi.fn(),
}));

const { SetlistDetailScreen } = await import('./SetlistDetailScreen.tsx');

const stem = (itemId: number, stemSetId: number) => ({
  kind: 'stem',
  item: { id: itemId },
  stemSetId,
});

const onOpenStemSet = vi.fn();
const onLoaded = vi.fn();

function mount(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(SetlistDetailScreen, {
        setlistId: SETLIST_ID,
        insets: { top: 0, bottom: 0 },
        onBack: vi.fn(),
        onEditPreset: vi.fn(),
        onLoaded,
        onOpenStemSet,
        onAddStemSongs: vi.fn(),
      }),
    );
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

function expectStoppedBeforeOpen(): void {
  expect(fake.stop).toHaveBeenCalledOnce();
  const [stopped] = fake.stop.mock.invocationCallOrder;
  const [opened] = onOpenStemSet.mock.invocationCallOrder;
  expect(stopped).toBeLessThan(opened ?? 0);
}

const rows = (tree: ReactTestRenderer) =>
  tree.root.findAll((node) => node.type === ('DragListRow' as never));

const press = (row: { props: Record<string, unknown> } | undefined) => {
  act(() => {
    (row?.props.onActions as () => void)();
  });
};

const openSheet = () => fake.sheets.findLast((sheet) => sheet.visible === true);

beforeEach(() => {
  vi.clearAllMocks();
  fake.songMenu = { kind: 'none', target: null };
  fake.sheets = [];
});

describe('setlist detail with stem songs', () => {
  it('lists every entry in order, and drags across both kinds', () => {
    fake.entries = [
      entry(1, 'Warm-up'),
      stem(2, NIGHT_BUS),
      entry(3, 'Ballad'),
    ];
    const listed = rows(mount());
    expect(listed.map((row) => row.props.title as string)).toEqual([
      'Warm-up',
      'Night Bus',
      'Ballad',
    ]);
    expect(
      listed.map((row) => {
        const { index, count } = row.props.reorder as {
          index: number;
          count: number;
        };
        return [index, count];
      }),
    ).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
  });

  it('shows a set of stem songs only as songs, not as empty', () => {
    fake.entries = [stem(2, NIGHT_BUS)];
    const tree = mount();
    expect(rows(tree)).toHaveLength(1);
    expect(
      tree.root.findAll((node) => node.type === ('EmptyState' as never)),
    ).toHaveLength(0);
  });

  it('is empty only with no entry of either kind', () => {
    fake.entries = [];
    const tree = mount();
    expect(
      tree.root.findAll((node) => node.type === ('EmptyState' as never)),
    ).toHaveLength(1);
  });

  it('plays from 1 by opening the stem player when entry 1 is a stem song', async () => {
    fake.entries = [stem(2, NIGHT_BUS), entry(3, 'Ballad')];
    const tree = mount();
    const play = tree.root.find(
      (node) =>
        node.type === ('Chip' as never) && node.props.label === 'Play from 1',
    );
    await act(async () => {
      (play.props.onPress as () => void)();
      await Promise.resolve();
    });
    expect(fake.openStemEntry).toHaveBeenCalledWith(2, SETLIST_ID);
    expect(onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    expectStoppedBeforeOpen();
    expect(fake.start).not.toHaveBeenCalled();
    expect(fake.loadSong).not.toHaveBeenCalled();
  });

  it('moves an entry across a stem and metronome boundary by its place in the whole set', () => {
    fake.entries = [
      entry(1, 'Warm-up'),
      stem(2, NIGHT_BUS),
      entry(3, 'Ballad'),
    ];
    const [, stemRow] = rows(mount());
    const { onMove } = stemRow?.props.reorder as {
      onMove: (from: number, to: number) => void;
    };
    onMove(1, 2);
    expect(fake.reorder).toHaveBeenCalledWith(SETLIST_ID, 1, 2);
  });

  it('loads a metronome entry without starting the click', async () => {
    fake.entries = [stem(2, NIGHT_BUS), entry(3, 'Ballad')];
    const [, ballad] = rows(mount());
    await act(async () => {
      (ballad?.props.onPress as () => void)();
      await Promise.resolve();
    });
    expect(fake.loadSong).toHaveBeenCalledWith(3, 3, SETLIST_ID);
    expect(fake.start).not.toHaveBeenCalled();
    expect(onLoaded).toHaveBeenCalled();
  });

  it('stops the click before it opens a stem row in the stem player', async () => {
    fake.entries = [entry(1, 'Warm-up'), stem(2, NIGHT_BUS)];
    const [, stemRow] = rows(mount());
    await act(async () => {
      (stemRow?.props.onPress as () => void)();
      await Promise.resolve();
    });
    expect(fake.openStemEntry).toHaveBeenCalledWith(2, SETLIST_ID);
    expect(onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    expectStoppedBeforeOpen();
  });

  it('stays put when the stem entry can no longer be opened', async () => {
    fake.entries = [stem(2, NIGHT_BUS)];
    fake.openStemEntry.mockResolvedValueOnce(false);
    const [stemRow] = rows(mount());
    await act(async () => {
      (stemRow?.props.onPress as () => void)();
      await Promise.resolve();
    });
    expect(onOpenStemSet).not.toHaveBeenCalled();
    expect(fake.stop).not.toHaveBeenCalled();
  });
});

describe('setlist entry actions button', () => {
  it('opens the song sheet for a preset entry, naming its place in the set', () => {
    const ballad = entry(3, 'Ballad');
    fake.entries = [stem(2, NIGHT_BUS), ballad];
    const [, row] = rows(mount());
    press(row);
    expect(fake.openSongActions).toHaveBeenCalledWith({
      preset: ballad.preset,
      itemId: 3,
    });
  });

  it('opens the stem sheet with its only action for a stem entry', () => {
    fake.entries = [entry(1, 'Warm-up'), stem(2, NIGHT_BUS)];
    const [, stemRow] = rows(mount());
    press(stemRow);
    expect(openSheet()?.title).toBe('Night Bus');
    expect(
      (openSheet()?.actions as { label: string }[]).map((a) => a.label),
    ).toEqual(['Remove from set']);
  });

  it('tints only the entry whose sheet is open', () => {
    fake.entries = [
      entry(1, 'Warm-up'),
      stem(2, NIGHT_BUS),
      entry(3, 'Ballad'),
    ];
    fake.songMenu = { kind: 'actions', target: { itemId: 3 } };
    const tree = mount();
    expect(rows(tree).map((row) => (row.props as Props).menuOpen)).toEqual([
      false,
      false,
      true,
    ]);
    press(rows(tree)[1]);
    expect(rows(tree)[1]?.props.menuOpen).toBe(true);
  });

  it('keeps the actions button and the drag handle apart', () => {
    fake.entries = [entry(1, 'Warm-up'), entry(3, 'Ballad')];
    const [warmUp] = rows(mount());
    press(warmUp);
    expect(fake.reorder).not.toHaveBeenCalled();
    expect(fake.loadSong).not.toHaveBeenCalled();
    fake.openSongActions.mockClear();
    const { onMove } = warmUp?.props.reorder as {
      onMove: (from: number, to: number) => void;
    };
    onMove(0, 1);
    expect(fake.openSongActions).not.toHaveBeenCalled();
  });
});
