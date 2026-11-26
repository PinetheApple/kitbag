import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const screens = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
const rig = vi.hoisted(() => ({
  live: null as Record<string, unknown> | null,
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: vi.fn() }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useLastTool: () => () => undefined,
  useRouteLatency: <T>(_store: unknown, selector: (s: typeof rig) => T) =>
    selector(rig),
}));
vi.mock('@/settings/rigRuntime', () => ({ routeLatency: {} }));
vi.mock('@/home/registry', () => ({ TOOL_ID: { sync: 'sync' } }));
vi.mock('@/home/ToolGate', () => ({
  gated: (_id: string, route: ComponentType) => route,
}));
vi.mock('@kitbag/tool-sync', () => ({
  PlayAlongScreen: (props: Record<string, unknown>) => {
    screens.props.push(props);
    return null;
  },
}));

const SyncRoute = (await import('../app/sync.tsx')).default;

function routeProp() {
  renderToStaticMarkup(createElement(SyncRoute));
  return screens.props.at(-1)?.route;
}

beforeEach(() => {
  screens.props = [];
  rig.live = null;
});

describe('Play along route', () => {
  it('hands the screen the live output route by kind and name', () => {
    rig.live = { id: 'bt', name: '', kind: 'bluetooth', certain: true };
    expect(routeProp()).toEqual({ icon: 'routeBluetooth', label: 'Bluetooth' });
  });

  it('hands no route before the output is known', () => {
    expect(routeProp()).toBeUndefined();
  });
});
