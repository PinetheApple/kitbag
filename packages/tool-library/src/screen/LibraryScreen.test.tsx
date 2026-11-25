// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Style = Record<string, unknown>;

const NAV_BAR = 24;
const list = vi.hoisted(() => ({ fab: 56, fabBottom: 16 }));
const pickers = vi.hoisted(() => ({
  importSong: vi.fn(() => Promise.resolve()),
  importStemFolder: vi.fn(() => Promise.resolve()),
}));
const FAB_ROOM = list.fab + list.fabBottom;
const bar = vi.hoisted(() => ({
  actions: [] as Record<string, unknown>[],
  upNextCount: 0,
}));

vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  Text: 'Text',
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  AppBar: (props: { actions?: Record<string, unknown>[] }) => {
    bar.actions = props.actions ?? [];
    return null;
  },
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
      rowPaths: new Map(),
      importing: [],
      notice: null,
      query: '',
      replacePrompt: null,
      refresh: () => Promise.resolve(),
      setQuery: () => undefined,
      ...pickers,
    }),
  useUpNextCount: () => bar.upNextCount,
  inView: () => true,
  filterRows: () => [],
  useDataFolder: (select: (state: { move: null; codes: null }) => unknown) =>
    select({ move: null, codes: null }),
}));

vi.mock('./LibraryRowView.tsx', () => ({ LibraryRowView: () => null }));

vi.mock('./LibrarySheets.tsx', () => ({
  LibrarySheets: (props: Props) =>
    createElement('Sheets', {
      bottomInset: props.bottomInset,
      onOpenQueue: props.onOpenQueue,
    }),
  useLibraryMenu: () => ({ kind: 'none' }),
}));

const { LibraryScreen } = await import('./LibraryScreen.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function mount(
  dock?: ReactNode,
  extra: Record<string, unknown> = {},
): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(LibraryScreen, {
        view: 'songs',
        insets: { top: 0, bottom: NAV_BAR },
        onBack: () => undefined,
        onOpenStemSet: () => undefined,
        onOpenSong: () => undefined,
        onOpenSetlist: () => undefined,
        onUnavailable: () => undefined,
        ...(dock === undefined ? {} : { dock: dock as never }),
        ...extra,
      }),
    );
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

function flat(style: unknown): Style {
  return [style]
    .flat(Infinity)
    .reduce<Style>((merged, s) => ({ ...merged, ...(s as Style) }), {});
}

function scrollBottom(tree: ReactTestRenderer) {
  return flat(
    tree.root.findByType('ScrollView' as never).props.contentContainerStyle,
  ).paddingBottom;
}

function frameBottom(tree: ReactTestRenderer) {
  const [frame] = tree.root.findAllByType('View' as never);
  if (frame === undefined) throw new Error('no frame');
  return flat(frame.props.style).paddingBottom;
}

function propOf(tree: ReactTestRenderer, type: string, name: string) {
  return tree.root.findByType(type as never).props[name] as unknown;
}

describe('the Songs screen with no song playing', () => {
  it('pads the navigation bar on the frame, under the list and the FAB', () => {
    const tree = mount();
    expect(frameBottom(tree)).toBe(NAV_BAR);
    expect(propOf(tree, 'Fab', 'bottomInset') ?? 0).toBe(0);
    expect(scrollBottom(tree)).toBe(FAB_ROOM);
  });
});

describe('the Songs screen with the mini-player docked', () => {
  const dock = createElement('Dock');

  it('draws the dock after the layer holding the list and the FAB', () => {
    const tree = mount(dock);
    const layer = tree.root.findByType('Fab' as never).parent;
    const docked = tree.root.findByType('Dock' as never);
    const siblings = docked.parent?.children ?? [];
    if (layer === null) throw new Error('the FAB has no layer');
    expect(siblings.indexOf(docked)).toBe(siblings.indexOf(layer) + 1);
  });

  it('lifts the FAB onto the bar, which covers the navigation bar', () => {
    const tree = mount(dock);
    expect(frameBottom(tree) ?? 0).toBe(0);
    expect(propOf(tree, 'Fab', 'bottomInset') ?? 0).toBe(0);
    expect(scrollBottom(tree)).toBe(FAB_ROOM);
  });

  it('keeps the sheets above the navigation bar', () => {
    expect(propOf(mount(dock), 'Sheets', 'bottomInset')).toBe(NAV_BAR);
  });
});

describe('the Stem songs screen with its own way to add', () => {
  beforeEach(() => {
    pickers.importStemFolder.mockClear();
  });

  it('opens what the route gives instead of the folder picker', () => {
    const onAdd = vi.fn();
    const tree = mount(undefined, { view: 'stems', onAdd });
    act(() => {
      (propOf(tree, 'Fab', 'onPress') as () => void)();
    });
    expect(onAdd).toHaveBeenCalledOnce();
    expect(pickers.importStemFolder).not.toHaveBeenCalled();
  });

  it('opens the folder picker when the route gives nothing', () => {
    const tree = mount(undefined, { view: 'stems' });
    act(() => {
      (propOf(tree, 'Fab', 'onPress') as () => void)();
    });
    expect(pickers.importStemFolder).toHaveBeenCalledOnce();
  });

  it('shows the status the route gives above the list', () => {
    const tree = mount(undefined, { status: createElement('Status') });
    expect(tree.root.findAllByType('Status' as never)).toHaveLength(1);
  });
});

describe('the data folder strip', () => {
  it('sits under the app bar, above the search and the list', () => {
    const tree = mount(undefined, { strip: createElement('Strip') });
    const strip = tree.root.findByType('Strip' as never);
    const siblings = strip.parent?.children ?? [];
    const body = siblings.find(
      (child) =>
        typeof child !== 'string' &&
        child.findAllByType('ScrollView' as never).length > 0,
    );
    if (body === undefined) throw new Error('no list body');
    expect(siblings.indexOf(strip)).toBe(siblings.indexOf(body) - 1);
  });
});

describe('the queue from the lists', () => {
  const queueAction = () => bar.actions.find((a) => a.icon === 'queue');

  beforeEach(() => {
    bar.upNextCount = 0;
  });

  it('puts a Queue key in the Stem songs app bar, badged with the count up next', () => {
    const onOpenQueue = vi.fn();
    bar.upNextCount = 3;
    mount(undefined, { view: 'stems', onOpenQueue });
    expect(queueAction()).toMatchObject({
      label: 'Queue, 3 up next',
      badge: '3',
    });
    (queueAction()?.onPress as () => void)();
    expect(onOpenQueue).toHaveBeenCalledOnce();
  });

  it('draws no badge with nothing up next', () => {
    mount(undefined, { view: 'stems', onOpenQueue: vi.fn() });
    expect(queueAction()).toMatchObject({ label: 'Queue' });
    expect(queueAction()?.badge).toBeUndefined();
  });

  it('keeps the Songs app bar to its own keys', () => {
    mount(undefined, { onOpenQueue: vi.fn() });
    expect(queueAction()).toBeUndefined();
  });

  it('gives the sheets the queue for their snackbars on both lists', () => {
    const onOpenQueue = vi.fn();
    expect(
      propOf(mount(undefined, { onOpenQueue }), 'Sheets', 'onOpenQueue'),
    ).toBe(onOpenQueue);
  });
});
