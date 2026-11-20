import type { LibraryRow } from '@kitbag/core-state';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const GRID_ICON = 'icon:beatGrid';

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) =>
    h('div', { 'aria-label': props.accessibilityLabel }, props.children);
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
    Badge: (props: Props) => h('i', null, String(props.label)),
    EllipsizedText: (props: Props) => h('span', null, props.children),
    libraryList: new Proxy({}, { get: () => 0 }),
    Icon: (props: Props) => h('i', null, `icon:${String(props.name)}`),
    createThemedStyles: () => () => new Proxy({}, { get: () => ({}) }),
    useTheme: () => ({ color: {}, feedback: {} }),
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongLibrary: (select: (state: { codes: unknown }) => unknown) =>
    select({ codes: {} }),
  analysisFailure: () => null,
  rowFilesOf: () => null,
  useLibrary: () => () => undefined,
  useStemPlayer: () => null,
  useSongPlayer: () => null,
  useShownSongId: () => null,
  useShownStemSetId: () => null,
}));

const { LibraryRowView } = await import('./LibraryRowView.tsx');

const STEM_ROW = {
  kind: 'stems',
  id: 1,
  title: 'Redbone',
  artist: null,
  durationSec: 30,
  bpm: null,
  key: null,
  scale: null,
  hasGrid: true,
  stemCount: 6,
} as unknown as LibraryRow;

function render(row: LibraryRow): string {
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

describe('a stem song row', () => {
  it('shows the grid icon and no pill text when the song has a grid', () => {
    const markup = render(STEM_ROW);
    expect(markup).toContain(GRID_ICON);
    expect(markup).not.toContain('GRID');
    expect(markup).not.toContain('STEMS');
  });

  it('shows no grid icon and no pill when the song has no grid', () => {
    const markup = render({ ...STEM_ROW, hasGrid: false });
    expect(markup).not.toContain(GRID_ICON);
    expect(markup).not.toContain('GRID');
    expect(markup).not.toContain('STEMS');
  });

  it('says whether the song has a grid, and no stem count', () => {
    expect(render(STEM_ROW)).toContain(
      'aria-label="Redbone, 30 seconds, Beat grid ready"',
    );
    expect(render({ ...STEM_ROW, hasGrid: false })).toContain(
      'aria-label="Redbone, 30 seconds, No beat grid found"',
    );
  });
});
