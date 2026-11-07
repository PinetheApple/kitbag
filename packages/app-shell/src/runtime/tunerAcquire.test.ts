import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spies = vi.hoisted(() => ({
  focusEffects: [] as (() => (() => void) | undefined)[],
  release: vi.fn(),
  acquire: vi.fn(),
  enter: vi.fn(),
  leave: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({}),
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    spies.focusEffects.push(effect);
  },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('@kitbag/core-native', () => ({ KB_TUNER_A4_HZ: {} }));
vi.mock('@kitbag/core-state', () => ({
  useLastTool: () => () => undefined,
  tunerStore: {
    getState: () => ({
      acquire: spies.acquire,
      enter: spies.enter,
      leave: spies.leave,
    }),
  },
}));
vi.mock('@/home/registry', () => ({ TOOL_ID: { tuner: 'tuner' } }));
vi.mock('@/home/ToolGate', () => ({
  gated: (_id: string, route: ComponentType) => route,
}));
vi.mock('@/runtime/backOrHome', () => ({
  useBackOrHome: () => () => undefined,
}));
vi.mock('@kitbag/tool-tuner', () => ({
  DEFAULT_TUNING: { name: 'default' },
  TunerScreen: () => null,
}));

const { default: TunerRoute } = await import('../app/tuner.tsx');

describe('the tuner route', () => {
  beforeEach(() => {
    spies.focusEffects.length = 0;
    spies.release.mockReset();
    spies.acquire.mockReset().mockReturnValue(spies.release);
    spies.enter.mockReset();
    spies.leave.mockReset();
  });

  it('releases the hold it acquired on blur, never a bare leave', () => {
    renderToStaticMarkup(createElement(TunerRoute));
    const cleanups = spies.focusEffects.map((effect) => effect());
    expect(spies.acquire).toHaveBeenCalledWith({ name: 'default' });
    cleanups.forEach((cleanup) => cleanup?.());
    expect(spies.release).toHaveBeenCalledOnce();
    expect(spies.enter).not.toHaveBeenCalled();
    expect(spies.leave).not.toHaveBeenCalled();
  });
});
