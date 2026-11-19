// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entry } from '../logic/fixtures.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const SETLIST_ID = 4;
const NIGHT_BUS = 9;

const fake = vi.hoisted(() => ({
  entries: [] as unknown[],
  openStemEntry: vi.fn(() => Promise.resolve(true)),
  loadSong: vi.fn(() => Promise.resolve()),
  start: vi.fn(),
  stop: vi.fn(),
}));

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
  stemSongFacts: () => '3:52 · A maj · 104 BPM',
  useStemSongs: () => new Map([[9, { id: 9, title: 'Night Bus' }]]),
  useLibrary: (select: (state: unknown) => unknown) =>
    select({
      ready: true,
      loaded: null,
      entries: { [SETLIST_ID]: fake.entries },
      setlists: [{ setlist: { id: SETLIST_ID, name: 'Gig' } }],
      reorder: vi.fn(),
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
vi.mock('./SongMenu.tsx', () => ({
  useSongMenu: () => ({ openActions: vi.fn() }),
  SongMenuSheets: () => null,
}));
vi.mock('./DetailMenu.tsx', () => ({
  useDetailMenu: () => ({ openAdd: vi.fn(), openSave: vi.fn() }),
  DetailSheets: () => null,
}));
vi.mock('./sheets.tsx', () => ({ ActionsSheet: () => null, guarded: vi.fn() }));

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

const rows = (tree: ReactTestRenderer) =>
  tree.root.findAll((node) => node.type === ('DragListRow' as never));

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(fake.start).not.toHaveBeenCalled();
    expect(fake.loadSong).not.toHaveBeenCalled();
  });
});
