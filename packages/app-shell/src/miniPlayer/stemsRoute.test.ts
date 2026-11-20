import { createElement, isValidElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NAV_BAR } from '../safeAreaInsets.test-helper.ts';

const state = vi.hoisted(() => ({
  docked: false,
  props: undefined as Record<string, unknown> | undefined,
  openQueue: () => undefined,
}));

vi.mock(
  'react-native-safe-area-context',
  async () =>
    (await import('../safeAreaInsets.test-helper.ts')).safeAreaContextMock,
);
vi.mock('expo-router', () => ({
  useRouter: () => ({}),
  useLocalSearchParams: () => ({}),
}));
vi.mock('@/home/registry', () => ({ TOOL_ID: { stems: 'stems' } }));
vi.mock('@/home/ToolGate', () => ({
  gated: (_id: string, route: ComponentType) => route,
}));
vi.mock('@/runtime/stemDeckRoutes', () => ({ useStemDeckRoutes: () => ({}) }));
vi.mock('@kitbag/core-state', () => {
  const select = (value: unknown) => (pick: (s: unknown) => unknown) =>
    pick(value);
  return {
    useLastTool: select({ markUsed: () => undefined }),
    useSongLibrary: select({ importStemFolder: () => undefined }),
    useStemDeck: select({ importView: null }),
  };
});
vi.mock('@kitbag/tool-library', () => ({
  LibraryScreen: (props: Record<string, unknown>) => {
    state.props = props;
    return null;
  },
}));
vi.mock('@kitbag/tool-stems', () => ({
  AddStemSongSheet: () => null,
  ImportStatusCard: () => null,
  importCardShows: () => false,
}));
vi.mock('./useMiniPlayerDocked', () => ({
  useMiniPlayerDocked: () => state.docked,
}));
vi.mock('./DockedMiniPlayer', () => ({ DockedMiniPlayer: () => null }));
vi.mock('@/queue/useQueueSheet', () => ({
  useQueueSheet: () => ({ open: state.openQueue, sheet: null }),
}));
vi.mock('@/dataFolder/useLibraryFolder', () => ({
  useLibraryFolder: () => ({
    strip: null,
    sheet: null,
    showUnavailable: () => undefined,
  }),
}));

const StemSongsRoute = (await import('../app/stems/index.tsx')).default;

function render(docked: boolean) {
  state.docked = docked;
  renderToStaticMarkup(createElement(StemSongsRoute));
  return state.props ?? {};
}

beforeEach(() => {
  state.props = undefined;
});

describe('the Stem songs route', () => {
  it('docks nothing while the mini-player is not docked', () => {
    expect(render(false)).not.toHaveProperty('dock');
  });

  it('docks the mini-player over the navigation bar', () => {
    const { dock } = render(true);
    expect(isValidElement(dock)).toBe(true);
    expect((dock as { props: { bottomInset: number } }).props).toEqual({
      bottomInset: NAV_BAR,
      onOpenQueue: state.openQueue,
    });
  });

  it('opens the queue sheet from the list', () => {
    expect(render(false).onOpenQueue).toBe(state.openQueue);
  });
});
