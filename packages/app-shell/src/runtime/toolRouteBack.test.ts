import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({
  canGoBack: vi.fn(() => true),
  back: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
}));
const screens = vi.hoisted(() => ({
  props: [] as { readonly onBack?: () => void }[],
}));

vi.mock('expo-router', () => ({
  useRouter: () => router,
  useFocusEffect: () => undefined,
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('@kitbag/core-native', () => ({ KB_TUNER_A4_HZ: {} }));
vi.mock('@kitbag/core-state', () => ({
  useLastTool: () => () => undefined,
  tunerStore: { getState: () => ({}) },
}));
vi.mock('@/home/registry', () => ({
  TOOL_ID: { tuner: 'tuner', metronome: 'metronome' },
}));
vi.mock('@/home/ToolGate', () => ({
  gated: (_id: string, route: ComponentType) => route,
}));

function captureScreen(props: { readonly onBack?: () => void }) {
  screens.props.push(props);
  return null;
}

vi.mock('@kitbag/tool-tuner', () => ({
  DEFAULT_TUNING: {},
  TunerScreen: captureScreen,
}));
vi.mock('@kitbag/tool-metronome', () => ({ MetronomeScreen: captureScreen }));

const ROUTES = {
  tuner: (await import('../app/tuner.tsx')).default,
  metronome: (await import('../app/metronome.tsx')).default,
};

function onBackOf(route: ComponentType): () => void {
  renderToStaticMarkup(createElement(route));
  const onBack = screens.props.at(-1)?.onBack;
  if (onBack === undefined) throw new Error('route passed no onBack');
  return onBack;
}

beforeEach(() => {
  vi.clearAllMocks();
  router.canGoBack.mockReturnValue(true);
  screens.props = [];
});

describe.each(Object.entries(ROUTES))('%s route back key', (_name, route) => {
  it('goes back one screen', () => {
    onBackOf(route)();
    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('goes Home when opened with no history', () => {
    router.canGoBack.mockReturnValue(false);
    onBackOf(route)();
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });
});
