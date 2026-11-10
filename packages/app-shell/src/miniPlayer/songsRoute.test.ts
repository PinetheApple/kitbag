import { createElement, isValidElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NAV_BAR } from '../safeAreaInsets.test-helper.ts';

const state = vi.hoisted(() => ({
  docked: false,
  props: undefined as Record<string, unknown> | undefined,
}));

vi.mock(
  'react-native-safe-area-context',
  async () =>
    (await import('../safeAreaInsets.test-helper.ts')).safeAreaContextMock,
);
vi.mock('expo-router', () => ({ useRouter: () => ({}) }));
vi.mock('@/home/registry', () => ({
  TOOL_ID: { library: 'library', metronome: 'metronome' },
}));
vi.mock('@/home/ToolGate', () => ({
  gated: (_id: string, route: ComponentType) => route,
}));
vi.mock('@/home/toolsOn', () => ({ useToolOn: () => () => false }));
vi.mock('@kitbag/core-state', () => ({
  useLastTool: (select: (s: unknown) => unknown) =>
    select({ markUsed: () => undefined }),
}));
vi.mock('@kitbag/tool-library', () => ({
  LibraryScreen: (props: Record<string, unknown>) => {
    state.props = props;
    return null;
  },
}));
vi.mock('./useMiniPlayerDocked', () => ({
  useMiniPlayerDocked: () => state.docked,
}));
vi.mock('./DockedMiniPlayer', () => ({ DockedMiniPlayer: () => null }));

const SongsRoute = (await import('../app/library.tsx')).default;

function render(docked: boolean) {
  state.docked = docked;
  renderToStaticMarkup(createElement(SongsRoute));
  return state.props ?? {};
}

beforeEach(() => {
  state.props = undefined;
});

describe('the Songs route', () => {
  it('docks nothing while the mini-player is not docked', () => {
    expect(render(false)).not.toHaveProperty('dock');
  });

  it('docks the mini-player over the navigation bar', () => {
    const { dock } = render(true);
    expect(isValidElement(dock)).toBe(true);
    expect((dock as { props: { bottomInset: number } }).props).toEqual({
      bottomInset: NAV_BAR,
    });
  });
});
