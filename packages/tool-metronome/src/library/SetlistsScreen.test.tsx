// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { songPreset } from '../logic/fixtures.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const GIG = 4;
const QUERY = 'black';

const fake = vi.hoisted(() => {
  const setlistMenu: Record<string, unknown> = { open: { kind: 'none' } };
  const songMenu: Record<string, unknown> = { kind: 'none', target: null };
  const results: unknown = null;
  return {
    openSetlistActions: vi.fn(),
    openSongActions: vi.fn(),
    closeSongMenu: vi.fn(),
    onEditPreset: vi.fn(),
    setlistMenu,
    songMenu,
    sheets: [] as Props[],
    results,
  };
});

vi.mock('react-native', () => ({ View: 'View', Text: 'Text' }));
vi.mock('@kitbag/core-design', () => ({
  AppBar: 'AppBar',
  Badge: 'Badge',
  EmptyState: 'EmptyState',
  FloatingActionButton: 'FloatingActionButton',
  ListRow: 'ListRow',
  PlainListRow: 'PlainListRow',
  SearchField: 'SearchField',
  createThemedStyles: () => () => ({}),
  textStyle: () => ({}),
  snackbar: { aboveSheet: 0, minHeight: 0 },
  space: {},
  textRoles: {},
}));
vi.mock('@kitbag/core-state', () => ({
  useLibrary: (select: (state: unknown) => unknown) =>
    select({
      ready: true,
      played: [],
      standalone: [],
      setlists: [
        { setlist: { id: GIG, name: 'Gig', active: false }, songCount: 2 },
      ],
      results: fake.results,
      search: vi.fn(),
      loadSong: vi.fn(),
    }),
}));
vi.mock('../logic/songSummary.ts', () => ({
  setlistSubtitle: () => '2 songs',
  songSubtitle: () => '96 · 3/4',
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
vi.mock('./LibraryUndoSnackbar.tsx', () => ({
  useLibraryUndoShown: () => false,
}));
vi.mock('./SetlistsMenu.tsx', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSetlistsMenu: () => ({
    ...fake.setlistMenu,
    openActions: fake.openSetlistActions,
  }),
  SetlistsSheets: () => null,
}));
vi.mock('./SongMenu.tsx', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongMenu: () => ({
    ...fake.songMenu,
    openActions: fake.openSongActions,
    close: fake.closeSongMenu,
  }),
}));
vi.mock('./sheets.tsx', () => ({
  ActionsSheet: (props: Props) => {
    fake.sheets.push(props);
    return null;
  },
  guarded: vi.fn(),
}));

const { SetlistsScreen } = await import('./SetlistsScreen.tsx');

const song = songPreset({ id: 7, name: 'Blackbird' });

function mount(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(SetlistsScreen, {
        insets: { top: 0, bottom: 0 },
        onBack: vi.fn(),
        onOpenSetlist: vi.fn(),
        onOpenAllSongs: vi.fn(),
        onLoaded: vi.fn(),
        onEditPreset: fake.onEditPreset,
      }),
    );
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

const hosts = (tree: ReactTestRenderer, type: string) =>
  tree.root
    .findAll((node) => node.type === (type as never))
    .map((node) => node.props as Props);

const titled = (tree: ReactTestRenderer, type: string, title: string) => {
  const found = hosts(tree, type).find((props) => props.title === title);
  if (found === undefined) throw new Error(`no ${type} ${title}`);
  return found;
};

function searched(): ReactTestRenderer {
  fake.results = { setlists: [{ id: GIG, name: 'Gig' }], presets: [song] };
  const tree = mount();
  const [field] = hosts(tree, 'SearchField');
  act(() => {
    (field?.onChangeText as (query: string) => void)(QUERY);
  });
  return tree;
}

const call = (handler: unknown) => {
  (handler as () => void)();
};

beforeEach(() => {
  vi.clearAllMocks();
  fake.setlistMenu = { open: { kind: 'none' } };
  fake.songMenu = { kind: 'none', target: null };
  fake.sheets = [];
  fake.results = null;
});

describe('setlist rows', () => {
  it('open the setlist sheet from the actions button', () => {
    call(titled(mount(), 'ListRow', 'Gig').onActions);
    expect(fake.openSetlistActions).toHaveBeenCalledWith(GIG);
  });

  it('give All songs no actions button, since it has no actions', () => {
    expect(titled(mount(), 'ListRow', 'All songs').onActions).toBeUndefined();
  });

  it('tint the row whose sheet is open', () => {
    fake.setlistMenu = { open: { kind: 'actions', setlistId: GIG } };
    expect(titled(mount(), 'ListRow', 'Gig').menuOpen).toBe(true);
  });
});

describe('search results', () => {
  it('open the setlist sheet from a setlist result, by button or long-press', () => {
    const result = titled(searched(), 'ListRow', 'Gig');
    call(result.onActions);
    call(result.onLongPress);
    expect(fake.openSetlistActions).toHaveBeenNthCalledWith(1, GIG);
    expect(fake.openSetlistActions).toHaveBeenNthCalledWith(2, GIG);
  });

  it('open the song sheet with no set from a song result, by button or long-press', () => {
    const result = titled(searched(), 'PlainListRow', 'Blackbird');
    call(result.onActions);
    call(result.onLongPress);
    const target = { preset: song, itemId: null };
    expect(fake.openSongActions).toHaveBeenNthCalledWith(1, target);
    expect(fake.openSongActions).toHaveBeenNthCalledWith(2, target);
  });

  it('give a song result the no-set song sheet, whose Edit opens the editor', () => {
    fake.songMenu = { kind: 'actions', target: { preset: song, itemId: null } };
    searched();
    const sheet = fake.sheets.findLast((s) => s.visible === true);
    const actions = sheet?.actions as { label: string; onPress: () => void }[];
    expect(actions.map((a) => a.label)).toEqual([
      'Edit',
      'Duplicate',
      'Add to setlist',
      'Delete song',
    ]);
    actions[0]?.onPress();
    expect(fake.onEditPreset).toHaveBeenCalledWith(song.id);
  });

  it('tint the song result whose sheet is open', () => {
    fake.songMenu = { kind: 'actions', target: { preset: song, itemId: null } };
    expect(titled(searched(), 'PlainListRow', 'Blackbird').menuOpen).toBe(true);
  });
});
