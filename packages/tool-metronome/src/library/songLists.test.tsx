import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { songPreset } from '../logic/fixtures.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
interface Action {
  readonly label: string;
}

const seen = vi.hoisted(() => ({ actions: [] as readonly Action[] }));
const library = vi.hoisted((): { state: Record<string, unknown> } => ({
  state: {},
}));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  return {
    View: (props: Props) => h('div', null, props.children),
    Text: (props: Props) => h('span', null, props.children),
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useLibrary: (select: (state: unknown) => unknown) => select(library.state),
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    textStyle: () => ({}),
    AppBar: () => null,
    EmptyState: () => null,
    FloatingActionButton: () => null,
    ListRow: () => null,
    SearchField: () => null,
    TimedSnackbar: () => null,
    useSnackbarShown: () => false,
    Badge: (props: Props) => h('output', null, props.label as string),
  };
});

vi.mock('./sheets.tsx', () => ({
  ActionsSheet: (props: { readonly actions: readonly Action[] }) => {
    seen.actions = props.actions;
    return null;
  },
  ConfirmSheet: () => null,
  guarded: () => Promise.resolve(),
}));
vi.mock('./AddSongSheet.tsx', () => ({
  AddSongSheet: (props: { readonly metronomeActions: readonly Action[] }) => {
    seen.actions = props.metronomeActions;
    return null;
  },
}));
vi.mock('./ScreenFrame.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    ScreenFrame: (props: Props) => h('main', null, props.children),
  };
});
vi.mock('./SetlistsMenu.tsx', () => ({
  SetlistsSheets: () => null,
  useSetlistsMenu: () => ({ openCreate: () => undefined }),
}));
vi.mock('./SearchResultsList.tsx', () => ({ SearchResultsList: () => null }));
vi.mock('./useLibraryRefresh.ts', () => ({
  useLibraryRefresh: () => undefined,
}));

const { DetailSheets } = await import('./DetailMenu.tsx');
const { SetlistsScreen } = await import('./SetlistsScreen.tsx');

const linked = songPreset({ id: 1, name: 'Linked click', librarySongId: 9 });
const unlinked = songPreset({ id: 2, name: 'Plain song' });
const INSETS = { top: 0, bottom: 0 };
const ignore = () => undefined;

const menu = {
  kind: 'add',
  error: null,
  setError: ignore,
  openAdd: ignore,
  openSave: ignore,
  close: ignore,
} as const;

beforeEach(() => {
  seen.actions = [];
  library.state = {
    ready: true,
    loaded: null,
    setlists: [],
    presets: [linked, unlinked],
    metronomeSongs: [unlinked],
    standalone: [unlinked],
  };
});

describe('song-linked presets on metronome screens', () => {
  it('offers only unlinked presets in the Add song sheet', () => {
    renderToStaticMarkup(
      createElement(DetailSheets, {
        menu,
        setlistId: 1,
        entries: [],
        bottomInset: 0,
        onEdit: ignore,
        onAddStemSongs: ignore,
      }),
    );
    expect(seen.actions.map((action) => action.label)).toEqual([
      'New song from the metronome',
      unlinked.name,
    ]);
  });

  it('counts only unlinked presets on the All songs row', () => {
    const markup = renderToStaticMarkup(
      createElement(SetlistsScreen, {
        insets: INSETS,
        onBack: ignore,
        onOpenSetlist: ignore,
        onOpenAllSongs: ignore,
        onLoaded: ignore,
      }),
    );
    expect(markup).toContain('<output>1</output>');
  });
});
