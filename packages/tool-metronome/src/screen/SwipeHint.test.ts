import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { metronome } from '@kitbag/core-design';

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
  importantForAccessibility?: string;
  style?: unknown;
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

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity)) as Record<
    string,
    unknown
  >;
}

function placed(zoneTop: number, zoneHeight: number) {
  const hint = SwipeHint({
    zoneTop,
    zoneHeight,
    gesture: SWIPE,
    onDismiss: vi.fn(),
  }) as ReactElement<Props>;
  const ring = [hint.props.children]
    .flat()
    .find(
      (child): child is ReactElement<Props> =>
        (child as ReactElement<Props> | null)?.props
          .importantForAccessibility === 'no-hide-descendants',
    );
  return {
    top: flat(hint.props.style).paddingTop,
    height: flat(ring?.props.style).height,
  };
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

  it('fits the ring to a zone shorter than the drawn ring, from its top', () => {
    const ZONE_TOP = 120;
    const SHORT_ZONE = metronome.coachRingHeight / 2;
    expect(placed(ZONE_TOP, SHORT_ZONE)).toEqual({
      top: ZONE_TOP,
      height: SHORT_ZONE,
    });
  });

  it('keeps the drawn ring centred on a zone taller than it', () => {
    const ZONE_TOP = 120;
    const SPARE = 40;
    expect(placed(ZONE_TOP, metronome.coachRingHeight + SPARE * 2)).toEqual({
      top: ZONE_TOP + SPARE,
      height: metronome.coachRingHeight,
    });
  });
});
