import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({
  focused: false,
  navigate: vi.fn(),
  topSetParams: vi.fn(),
  ownSetParams: vi.fn(),
}));
const screens = vi.hoisted(() => ({
  props: [] as {
    readonly focused?: boolean;
    readonly onOpenStemSet?: (stemSetId: number) => void;
    readonly renderUpNext?: (songSec: unknown) => unknown;
  }[],
  upNext: [] as Record<string, unknown>[],
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ navigate: nav.navigate, setParams: nav.topSetParams }),
  useNavigation: () => ({ setParams: nav.ownSetParams }),
  useIsFocused: () => nav.focused,
  useLocalSearchParams: () => ({ id: '4' }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('@/home/registry', () => ({
  TOOL_ID: { library: 'library', stems: 'stems' },
}));
vi.mock('@/home/ToolGate', () => ({
  gated: (_id: string, route: ComponentType) => route,
}));

vi.mock('@/queue/useQueueSheet', () => ({
  useQueueSheet: () => ({ open: vi.fn(), sheet: null }),
}));

function captureScreen(props: (typeof screens.props)[number]) {
  screens.props.push(props);
  return null;
}

vi.mock('@kitbag/tool-library', () => ({ SongPlayerScreen: captureScreen }));
vi.mock('@kitbag/tool-stems', () => ({
  StemPlayerScreen: captureScreen,
  QueueSheet: () => null,
  UpNextRow: (props: Record<string, unknown>) => {
    screens.upNext.push(props);
    return null;
  },
  useMixerFrame: () => ({}),
}));

const ROUTES = {
  song: (await import('../app/library/[id].tsx')).default,
  stems: (await import('../app/stems/[id].tsx')).default,
};
const { useLibraryRoutes } = await import('./libraryRoutes.ts');

function routes() {
  let captured: ReturnType<typeof useLibraryRoutes> | undefined;
  const Probe = () => {
    captured = useLibraryRoutes();
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  if (captured === undefined) throw new Error('not rendered');
  return captured;
}

beforeEach(() => {
  vi.clearAllMocks();
  screens.props = [];
  screens.upNext = [];
});

describe.each(Object.entries(ROUTES))('the %s player route', (_name, route) => {
  it.each([true, false])('hands the screen focused=%s', (focused) => {
    nav.focused = focused;
    renderToStaticMarkup(createElement(route));
    expect(screens.props.at(-1)?.focused).toBe(focused);
  });
});

describe('the song player route', () => {
  it("gives the screen the stem player's Up next row, pressing the song player's Next and Previous", async () => {
    const { songPlayerStore } = await import('@kitbag/core-state');
    renderToStaticMarkup(createElement(ROUTES.song));
    const songSec = { value: 0 };
    const row = screens.props.at(-1)?.renderUpNext?.(songSec);
    renderToStaticMarkup(row as Parameters<typeof renderToStaticMarkup>[0]);
    const { pressNext, pressPrevious } = songPlayerStore.getState();
    expect(screens.upNext.at(-1)).toMatchObject({
      songSec,
      onNext: pressNext,
      onPrevious: pressPrevious,
    });
  });
});

describe('the stem player following the next song', () => {
  it('changes its own route, never the route on top of it', () => {
    renderToStaticMarkup(createElement(ROUTES.stems));
    screens.props.at(-1)?.onOpenStemSet?.(9);
    expect(nav.ownSetParams).toHaveBeenCalledWith({ id: '9' });
    expect(nav.topSetParams).not.toHaveBeenCalled();
  });
});

describe('opening a player', () => {
  it('calls navigate for a stem song', () => {
    routes().openStemSet(4);
    expect(nav.navigate).toHaveBeenCalledWith('/stems/4');
  });

  it('calls navigate for a song', () => {
    routes().openSong(4);
    expect(nav.navigate).toHaveBeenCalledWith('/library/4');
  });
});
