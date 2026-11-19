// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const ROWS = [
  { kind: 'song', id: 1, title: 'Everlong' },
  { kind: 'song', id: 2, title: 'Redbone' },
];

const PHASES = { copying: 'COPYING', catchUp: 'CATCH_UP' };

const MOVE = {
  phase: PHASES.copying,
  path: 'songs/b2/waveform.bin',
  running: true,
  switched: false,
};

vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  Text: 'Text',
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  AppBar: () => null,
  FloatingActionButton: () => null,
  SearchField: () => null,
  libraryList: new Proxy({}, { get: () => 0 }),
  textStyle: () => ({}),
  createThemedStyles: () => () => new Proxy({}, { get: () => ({}) }),
}));

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongLibrary: (select: (state: unknown) => unknown) =>
    select({
      failed: false,
      ready: true,
      rows: ROWS,
      rowPaths: new Map([
        ['song:1', ['songs/a1/Everlong.mp3']],
        ['song:2', ['songs/b2/Redbone.mp3']],
      ]),
      importing: [],
      notice: null,
      query: '',
      replacePrompt: null,
      refresh: () => Promise.resolve(),
      setQuery: () => undefined,
    }),
  useDataFolder: (select: (state: unknown) => unknown) =>
    select({ move: MOVE, codes: { movePhases: PHASES } }),
  inView: () => true,
  filterRows: () => ROWS,
}));

vi.mock('./LibraryRowView.tsx', () => ({ LibraryRowView: 'Row' }));
vi.mock('./LibrarySheets.tsx', () => ({
  LibrarySheets: () => null,
  useLibraryMenu: () => ({ kind: 'none' }),
}));

const { LibraryScreen } = await import('./LibraryScreen.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('the row a move is copying', () => {
  it('is the only row marked moving', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(
        createElement(LibraryScreen, {
          view: 'songs',
          insets: { top: 0, bottom: 0 },
          onBack: () => undefined,
          onOpenStemSet: () => undefined,
          onOpenSong: () => undefined,
          onUnavailable: () => undefined,
        }),
      );
    });
    const rows = tree?.root.findAllByType('Row' as never) ?? [];
    expect(
      rows.map((row) => {
        const props = row.props as { row: { id: number }; moving: boolean };
        return [props.row.id, props.moving];
      }),
    ).toEqual([
      [1, false],
      [2, true],
    ]);
  });
});
