// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Style = Record<string, unknown>;

const NAV_BAR = 24;
const list = vi.hoisted(() => ({ fab: 56, fabBottom: 16 }));
const FAB_ROOM = list.fab + list.fabBottom;

vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  Text: 'Text',
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  AppBar: () => null,
  FloatingActionButton: 'Fab',
  libraryList: new Proxy(list, {
    get: (values, key): unknown => Reflect.get(values, key) ?? 0,
  }),
  SearchField: () => null,
  textStyle: () => ({}),
  createThemedStyles: (build: (theme: unknown) => unknown) => () =>
    build({ color: {} }),
}));

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongLibrary: (select: (state: unknown) => unknown) =>
    select({
      failed: false,
      ready: true,
      rows: [{ kind: 'song', id: 1 }],
      importing: [],
      notice: null,
      query: '',
      replacePrompt: null,
      refresh: () => Promise.resolve(),
      setQuery: () => undefined,
    }),
  inView: () => true,
  filterRows: () => [],
}));

vi.mock('./LibraryRowView.tsx', () => ({ LibraryRowView: () => null }));

vi.mock('./LibrarySheets.tsx', () => ({
  LibrarySheets: (props: Props) =>
    createElement('Sheets', { bottomInset: props.bottomInset }),
  useLibraryMenu: () => ({ kind: 'none' }),
}));

const { LibraryScreen } = await import('./LibraryScreen.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function mount(dock?: ReactNode): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(LibraryScreen, {
        view: 'songs',
        insets: { top: 0, bottom: NAV_BAR },
        onBack: () => undefined,
        onOpenStemSet: () => undefined,
        onOpenSong: () => undefined,
        ...(dock === undefined ? {} : { dock: dock as never }),
      }),
    );
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

function scrollBottom(tree: ReactTestRenderer) {
  const style = tree.root.findByType('ScrollView' as never).props
    .contentContainerStyle as readonly Style[];
  return style.reduce<Style>((merged, s) => ({ ...merged, ...s }), {})
    .paddingBottom;
}

function propOf(tree: ReactTestRenderer, type: string, name: string) {
  return tree.root.findByType(type as never).props[name] as unknown;
}

describe('the Songs screen with no song playing', () => {
  it('keeps the FAB and the list end above the navigation bar', () => {
    const tree = mount();
    expect(propOf(tree, 'Fab', 'bottomInset')).toBe(NAV_BAR);
    expect(scrollBottom(tree)).toBe(FAB_ROOM + NAV_BAR);
  });
});

describe('the Songs screen with the mini-player docked', () => {
  const dock = createElement('Dock');

  it('draws the dock below the list, outside the FAB layer', () => {
    const tree = mount(dock);
    const fab = tree.root.findByType('Fab' as never);
    const docked = tree.root.findByType('Dock' as never);
    expect(fab.parent).not.toBe(docked.parent);
  });

  it('lifts the FAB onto the bar, which covers the navigation bar', () => {
    const tree = mount(dock);
    expect(propOf(tree, 'Fab', 'bottomInset')).toBe(0);
    expect(scrollBottom(tree)).toBe(FAB_ROOM);
  });

  it('keeps the sheets above the navigation bar', () => {
    expect(propOf(mount(dock), 'Sheets', 'bottomInset')).toBe(NAV_BAR);
  });
});
