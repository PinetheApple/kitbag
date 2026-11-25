import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const back = vi.hoisted(() => ({
  effects: [] as (() => (() => void) | undefined)[],
  release: vi.fn(),
  handlers: [] as (() => void)[],
}));
const focusReaderOn = vi.hoisted(() => vi.fn());

vi.mock('react', async (original) => ({
  createContext: (await original<typeof import('react')>()).createContext,
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
  WindowOverlay: 'WindowOverlay',
  createThemedStyles: () => () => ({}),
  focusReaderOn,
  onHardwareBack: (handler: () => void) => {
    back.handlers.push(handler);
    return back.release;
  },
  useReduceMotionMode: () => undefined,
  withAlpha: () => undefined,
}));

const { SwipeHint } = await import('./SwipeHint.tsx');

const SWIPE = { swipe: 'tempo' } as unknown as Parameters<
  typeof SwipeHint
>[0]['gesture'];

type Props = Readonly<{
  accessibilityRole?: string;
  ref?: unknown;
  children?: ReactNode;
}>;

function headers(node: unknown): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(headers);
  if (node === null || typeof node !== 'object' || !('props' in node))
    return [];
  const element = node as ReactElement<Props>;
  const here = element.props.accessibilityRole === 'header' ? [element] : [];
  return [...here, ...headers(element.props.children)];
}

describe('SwipeHint', () => {
  it('dismisses on Back and releases Back when it goes', () => {
    const onDismiss = vi.fn();
    SwipeHint({ zoneTop: 0, zoneHeight: 0, gesture: SWIPE, onDismiss });
    const cleanups = back.effects.map((effect) => effect());
    back.handlers.forEach((handler) => {
      handler();
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    cleanups.forEach((cleanup) => cleanup?.());
    expect(back.release).toHaveBeenCalledOnce();
  });

  it('puts the tempo swipe on the dimmed overlay it draws', () => {
    const hint = SwipeHint({
      zoneTop: 0,
      zoneHeight: 0,
      gesture: SWIPE,
      onDismiss: vi.fn(),
    }) as ReactElement<{ gesture?: unknown }>;
    expect(hint.props.gesture).toBe(SWIPE);
  });

  it('moves screen reader focus to its title when it shows', () => {
    const [title] = headers(
      SwipeHint({
        zoneTop: 0,
        zoneHeight: 0,
        gesture: SWIPE,
        onDismiss: vi.fn(),
      }),
    );
    expect(title?.props.ref).toBe(focusReaderOn);
  });
});
