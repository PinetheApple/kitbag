import type { LibraryRow } from '@kitbag/core-state';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const ROW_ID = 4;

interface Shown {
  readonly status: string;
  readonly songId?: number | null;
  readonly setId?: number | null;
  readonly advancedTo?: number | null;
}

const now = vi.hoisted(() => ({
  song: {} as Shown,
  stem: {} as Shown,
  icons: [] as unknown[],
}));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) => h('div', null, props.children);
  return {
    View: box,
    Pressable: box,
    Text: (props: Props) => h('b', null, props.children),
    useWindowDimensions: () => ({ fontScale: 1 }),
  };
});

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    Badge: () => null,
    EllipsizedText: (props: Props) => h('span', null, props.children),
    libraryList: new Proxy({}, { get: () => 0 }),
    Icon: (props: Props) => {
      now.icons.push(props.name);
      return null;
    },
    createThemedStyles: () => () =>
      new Proxy({}, { get: (_styles, key) => ({ key }) }),
    useTheme: () => ({}),
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongLibrary: (select: (state: { codes: unknown }) => unknown) =>
    select({ codes: {} }),
  songBadge: () => 'grid',
  analysisFailure: () => null,
  rowFilesOf: () => null,
  useLibrary: () => () => undefined,
  useSongPlayer: (select: (state: unknown) => unknown) => select(now.song),
  useStemPlayer: (select: (state: unknown) => unknown) => select(now.stem),
}));

const { LibraryRowView } = await import('./LibraryRowView.tsx');

const STEM_ROW = {
  kind: 'stems',
  id: ROW_ID,
  title: 'Echo',
  artist: 'Charity Gayle',
  durationSec: 30,
  hasGrid: true,
  stemCount: 4,
} as unknown as LibraryRow;

const SONG_ROW = {
  kind: 'song',
  id: ROW_ID,
  title: 'Everlong',
  artist: '',
  durationSec: 30,
  bpm: 120,
  tempoCorrection: 'none',
} as unknown as LibraryRow;

function render(row: LibraryRow): string {
  now.icons = [];
  return renderToStaticMarkup(
    createElement(LibraryRowView, {
      row,
      selected: false,
      moving: false,
      onActions: vi.fn(),
      onOpenStemSet: vi.fn(),
      onOpenSong: vi.fn(),
      onUnavailable: vi.fn(),
    }),
  );
}

beforeEach(() => {
  now.song = { status: 'idle', songId: null };
  now.stem = { status: 'idle', setId: null };
});

describe('the row of the song the mini-player shows', () => {
  it('starts the facts of a playing stem song with Playing', () => {
    now.stem = { status: 'ready', setId: ROW_ID, advancedTo: null };
    expect(render(STEM_ROW)).toContain('Playing · 0:30');
  });

  it('keeps the stem song playing through an advance', () => {
    now.stem = { status: 'loading', setId: ROW_ID, advancedTo: ROW_ID };
    expect(render(STEM_ROW)).toContain('Playing · ');
  });

  it('says nothing for a stem song that is not playing', () => {
    now.song = { status: 'ready', songId: ROW_ID };
    expect(render(STEM_ROW)).not.toContain('Playing');
  });

  it('shows a pause tile, not Playing, for a playing single song', () => {
    now.song = { status: 'ready', songId: ROW_ID };
    expect(render(SONG_ROW)).not.toContain('Playing');
    expect(now.icons).toContain('pause');
  });

  it('shows the song tile for a single song that is not playing', () => {
    now.stem = { status: 'ready', setId: ROW_ID, advancedTo: null };
    render(SONG_ROW);
    expect(now.icons).not.toContain('pause');
  });
});
