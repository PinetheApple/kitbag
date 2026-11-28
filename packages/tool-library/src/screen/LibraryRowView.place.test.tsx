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
  song: { status: 'idle', songId: null as number | null },
}));

vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  Text: 'Text',
  useWindowDimensions: () => ({ fontScale: 1 }),
}));

vi.mock('@kitbag/core-design', async (original) => {
  const pure = await original<{ opacity: { muted: number } }>();
  const { usePlayingEdge } =
    await import('../../../core-design/src/components/usePlayingEdge.ts');
  return {
    ...pure,
    usePlayingEdge,
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
  useShownSongId: () => null,
  useShownStemSetId: () => library.player.setId,
  useLiveSongPlayer: (select: (state: typeof library.song) => unknown) =>
    select(library.song),
  useLiveStemPlayer: (select: (state: typeof library.player) => unknown) =>
    select(library.player),
}));

const { LibraryRowView } = await import('./LibraryRowView.tsx');
const { opacity } = await import('@kitbag/core-design');
const { ROW_TAP } = await import('@kitbag/core-state');

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
  library.song = { status: 'idle', songId: null };
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
    expect(handlers.onOpenSong).toHaveBeenCalledWith(ROW.id, ROW_TAP.view);
    expect(badgeLabels(tree)).toEqual(['MOVING']);
    expect(titleOpacity(tree)).toBeUndefined();
  });
});

describe('a row at home', () => {
  it('views a song that is not the open one, keeping the setlist', () => {
    pressRow(mount());
    expect(handlers.onOpenSong).toHaveBeenCalledExactlyOnceWith(
      ROW.id,
      ROW_TAP.view,
    );
    expect(library.endSetlistSession).not.toHaveBeenCalled();
    expect(handlers.onUnavailable).not.toHaveBeenCalled();
  });

  it('opens the open song as it is', () => {
    library.song = { status: 'ready', songId: ROW.id };
    pressRow(mount());
    expect(handlers.onOpenSong).toHaveBeenCalledExactlyOnceWith(
      ROW.id,
      ROW_TAP.asIs,
    );
    expect(library.endSetlistSession).not.toHaveBeenCalled();
  });

  it('opens the open stem song as it is', () => {
    library.player.setId = STEM_ROW.id;
    pressRow(mount(false, STEM_ROW));
    expect(handlers.onOpenStemSet).toHaveBeenCalledExactlyOnceWith(
      STEM_ROW.id,
      ROW_TAP.asIs,
    );
    expect(library.endSetlistSession).not.toHaveBeenCalled();
  });

  it('views a stem song that is not the open one', () => {
    library.player.setId = STEM_ROW.id + 1;
    pressRow(mount(false, STEM_ROW));
    expect(handlers.onOpenStemSet).toHaveBeenCalledExactlyOnceWith(
      STEM_ROW.id,
      ROW_TAP.view,
    );
    expect(library.endSetlistSession).not.toHaveBeenCalled();
  });
});
