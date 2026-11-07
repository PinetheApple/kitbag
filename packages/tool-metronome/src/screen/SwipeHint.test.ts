import { describe, expect, it, vi } from 'vitest';

const back = vi.hoisted(() => ({
  effects: [] as (() => (() => void) | undefined)[],
  release: vi.fn(),
  handlers: [] as (() => void)[],
}));

vi.mock('react', () => ({
  useEffect: (effect: () => (() => void) | undefined) => {
    back.effects.push(effect);
  },
  useMemo: <T>(make: () => T) => make(),
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'View' },
  FadeIn: { reduceMotion: () => ({}) },
}));
vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Button: 'Button',
  IconGlyph: 'IconGlyph',
  createThemedStyles: () => () => ({}),
  onHardwareBack: (handler: () => void) => {
    back.handlers.push(handler);
    return back.release;
  },
  useReduceMotionMode: () => undefined,
  withAlpha: () => undefined,
}));

const { SwipeHint } = await import('./SwipeHint.tsx');

describe('SwipeHint', () => {
  it('dismisses on Back and releases Back when it goes', () => {
    const onDismiss = vi.fn();
    SwipeHint({ zoneTop: 0, zoneHeight: 0, onDismiss });
    const cleanups = back.effects.map((effect) => effect());
    back.handlers.forEach((handler) => {
      handler();
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    cleanups.forEach((cleanup) => cleanup?.());
    expect(back.release).toHaveBeenCalledOnce();
  });
});
