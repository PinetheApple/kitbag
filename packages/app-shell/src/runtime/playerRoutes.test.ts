import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ focused: false, navigate: vi.fn() }));
const screens = vi.hoisted(() => ({
  props: [] as { readonly focused?: boolean }[],
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ navigate: nav.navigate }),
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

function captureScreen(props: { readonly focused?: boolean }) {
  screens.props.push(props);
  return null;
}

vi.mock('@kitbag/tool-library', () => ({ SongPlayerScreen: captureScreen }));
vi.mock('@kitbag/tool-stems', () => ({
  StemPlayerScreen: captureScreen,
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
  nav.navigate.mockClear();
  screens.props = [];
});

describe.each(Object.entries(ROUTES))('the %s player route', (_name, route) => {
  it.each([true, false])('hands the screen focused=%s', (focused) => {
    nav.focused = focused;
    renderToStaticMarkup(createElement(route));
    expect(screens.props.at(-1)?.focused).toBe(focused);
  });
});

describe('opening a player', () => {
  it('navigates to a stem song, so a repeat keeps one route', () => {
    routes().openStemSet(4);
    expect(nav.navigate).toHaveBeenCalledWith('/stems/4');
  });

  it('navigates to a song, so a repeat keeps one route', () => {
    routes().openSong(4);
    expect(nav.navigate).toHaveBeenCalledWith('/library/4');
  });
});
