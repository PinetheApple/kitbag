import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => {
  const params: Record<string, string> = { id: '4' };
  return {
    focused: false,
    params,
    navigate: vi.fn(),
    topSetParams: vi.fn(),
    ownSetParams: vi.fn(),
  };
});
const screens = vi.hoisted(() => ({
  props: [] as {
    readonly focused?: boolean;
    readonly view?: boolean;
    readonly onOpenStemSet?: (stemSetId: number) => void;
    readonly onOpenSong?: (songId: number) => void;
    readonly renderUpNext?: (songSec: unknown) => unknown;
    readonly onOpenQueue?: () => void;
  }[],
  upNext: [] as Record<string, unknown>[],
}));
const queueSheet = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock('expo-router', () => ({
  useRouter: () => ({ navigate: nav.navigate, setParams: nav.topSetParams }),
  useNavigation: () => ({ setParams: nav.ownSetParams }),
  useIsFocused: () => nav.focused,
  useLocalSearchParams: () => nav.params,
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

vi.mock('@/miniPlayer/useViewedPlayerDock', () => ({
  useViewedPlayerDock: () => ({}),
}));

vi.mock('@/queue/useQueueSheet', () => ({
  useQueueSheet: () => ({ open: queueSheet.open, sheet: null }),
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
const { useLibraryRoutes, VIEW_SONG } = await import('./libraryRoutes.ts');
const { ROW_TAP } = await import('@kitbag/core-state');

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
  nav.params = { id: '4' };
  screens.props = [];
  screens.upNext = [];
});

describe.each(Object.entries(ROUTES))('the %s player route', (_name, route) => {
  it.each([true, false])('hands the screen focused=%s', (focused) => {
    nav.focused = focused;
    renderToStaticMarkup(createElement(route));
    expect(screens.props.at(-1)?.focused).toBe(focused);
  });

  it('opens the song in view only when the row tap asked for it', () => {
    renderToStaticMarkup(createElement(route));
    expect(screens.props.at(-1)?.view).toBe(false);
    nav.params = { id: '4', [VIEW_SONG]: '1' };
    renderToStaticMarkup(createElement(route));
    expect(screens.props.at(-1)?.view).toBe(true);
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

describe("the song player's Queue key", () => {
  it('opens the queue sheet its Up next row opens', () => {
    renderToStaticMarkup(createElement(ROUTES.song));
    const row = screens.props.at(-1)?.renderUpNext?.({ value: 0 });
    renderToStaticMarkup(row as Parameters<typeof renderToStaticMarkup>[0]);
    expect(screens.props.at(-1)?.onOpenQueue).toBe(queueSheet.open);
    expect(screens.upNext.at(-1)?.onOpenSheet).toBe(queueSheet.open);
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

describe('a viewed player following the song that plays on', () => {
  it.each([
    ['stems', () => screens.props.at(-1)?.onOpenStemSet?.(9)],
    ['song', () => screens.props.at(-1)?.onOpenSong?.(9)],
  ] as const)('drops the view request from the %s route', (name, follow) => {
    nav.params = { id: '4', [VIEW_SONG]: '1' };
    renderToStaticMarkup(createElement(ROUTES[name]));
    follow();
    const [params] = nav.ownSetParams.mock.lastCall as [object];
    expect(params).toStrictEqual({ id: '9', [VIEW_SONG]: undefined });
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

  it('opens a row tap that views as it is or in view', () => {
    routes().openSong(4, ROW_TAP.asIs);
    expect(nav.navigate).toHaveBeenLastCalledWith('/library/4');
    routes().openSong(4, ROW_TAP.view);
    expect(nav.navigate).toHaveBeenLastCalledWith({
      pathname: '/library/[id]',
      params: { id: '4', [VIEW_SONG]: '1' },
    });
    routes().openStemSet(4, ROW_TAP.view);
    expect(nav.navigate).toHaveBeenLastCalledWith({
      pathname: '/stems/[id]',
      params: { id: '4', [VIEW_SONG]: '1' },
    });
  });
});
