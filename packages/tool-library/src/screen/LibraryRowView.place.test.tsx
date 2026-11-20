// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import type { LibraryRow, LibrarySongRow, RowFiles } from '@kitbag/core-state';
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const library = vi.hoisted(() => ({
  files: null as RowFiles | null,
  endSetlistSession: vi.fn(),
  player: { status: 'ready', setId: null as number | null },
}));

vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  Text: 'Text',
  useWindowDimensions: () => ({ fontScale: 1 }),
}));

vi.mock('@kitbag/core-design', async (original) => {
  const pure = await original<{ opacity: { muted: number } }>();
  return {
    ...pure,
    Badge: 'Badge',
    EllipsizedText: 'EllipsizedText',
    Icon: () => null,
    libraryList: new Proxy({}, { get: () => 0 }),
    createThemedStyles: () => () =>
      new Proxy(
        {},
        {
          get: (_styles, key) =>
            key === 'muted' ? { opacity: pure.opacity.muted } : {},
        },
      ),
    useTheme: () => ({}),
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongLibrary: (select: (state: { codes: unknown }) => unknown) =>
    select({ codes: {} }),
  songBadge: () => 'grid',
  analysisFailure: () => null,
  rowFilesOf: () => library.files,
  useLibrary: (select: (state: typeof library) => unknown) => select(library),
  useSongPlayer: () => null,
  useStemPlayer: (select: (state: typeof library.player) => unknown) =>
    select(library.player),
}));

const { LibraryRowView } = await import('./LibraryRowView.tsx');
const { opacity } = await import('@kitbag/core-design');

const ROW = {
  kind: 'song',
  id: 7,
  title: 'Everlong',
  artist: '',
  durationSec: 250,
  bpm: 158,
  tempoCorrection: 'none',
} as unknown as LibrarySongRow;

const handlers = {
  onActions: vi.fn(),
  onOpenStemSet: vi.fn(),
  onOpenSong: vi.fn(),
  onUnavailable: vi.fn(),
};

const STEM_ROW = { ...ROW, kind: 'stems', id: 9 } as unknown as LibraryRow;

function mount(moving = false, row: LibraryRow = ROW): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(LibraryRowView, {
        row,
        selected: false,
        moving,
        ...handlers,
      }),
    );
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

function pressRow(tree: ReactTestRenderer) {
  const [body] = tree.root.findAllByType('Pressable' as never);
  act(() => {
    (body?.props as { onPress: () => void }).onPress();
  });
}

const badgeLabels = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType('Badge' as never)
    .map((badge) => (badge.props as { label: string }).label);

const titleOpacity = (tree: ReactTestRenderer) => {
  const title = tree.root.findAllByType('EllipsizedText' as never)[0];
  const style = [(title?.props as { style: unknown }).style].flat(2);
  return (Object.assign({}, ...style) as { opacity?: number }).opacity;
};

beforeEach(() => {
  library.files = null;
  library.player.setId = null;
  vi.clearAllMocks();
});

describe('a row on a missing SD card', () => {
  beforeEach(() => {
    library.files = 'unavailable';
  });

  it('never opens the player and shows why instead', () => {
    pressRow(mount());
    expect(library.endSetlistSession).not.toHaveBeenCalled();
    expect(handlers.onOpenSong).not.toHaveBeenCalled();
    expect(handlers.onUnavailable).toHaveBeenCalledWith(ROW);
  });

  it('reads NO CARD with its title muted', () => {
    const tree = mount();
    expect(badgeLabels(tree)).toEqual(['NO CARD']);
    expect(titleOpacity(tree)).toBe(opacity.muted);
  });
});

describe('a row whose files are moving', () => {
  it('still opens the player, as its old copy plays', () => {
    const tree = mount(true);
    pressRow(tree);
    expect(handlers.onOpenSong).toHaveBeenCalledWith(ROW.id);
    expect(badgeLabels(tree)).toEqual(['MOVING']);
    expect(titleOpacity(tree)).toBeUndefined();
  });
});

describe('a row at home', () => {
  it('opens the player', () => {
    pressRow(mount());
    expect(handlers.onOpenSong).toHaveBeenCalledWith(ROW.id);
    expect(handlers.onUnavailable).not.toHaveBeenCalled();
  });

  it('ends the setlist started this session, as the song starts from a list', () => {
    pressRow(mount());
    expect(library.endSetlistSession).toHaveBeenCalledExactlyOnceWith(
      undefined,
    );
  });

  it('names the stem song it reopens when that song is the one playing', () => {
    library.player.setId = STEM_ROW.id;
    pressRow(mount(false, STEM_ROW));
    expect(library.endSetlistSession).toHaveBeenCalledExactlyOnceWith(
      STEM_ROW.id,
    );
    expect(handlers.onOpenStemSet).toHaveBeenCalledWith(STEM_ROW.id);
  });

  it('starts a stem song that is not the one playing as a new song', () => {
    library.player.setId = STEM_ROW.id + 1;
    pressRow(mount(false, STEM_ROW));
    expect(library.endSetlistSession).toHaveBeenCalledExactlyOnceWith(
      undefined,
    );
  });
});
