import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { MiniPlayerBar } from './MiniPlayerBar.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const pressables = vi.hoisted(() => [] as Props[]);
const animated = vi.hoisted(() => [] as StyleProp<ViewStyle>[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    Pressable: (props: Props) => {
      pressables.push(props);
      return h('div', null, props.children);
    },
  };
});

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  return {
    default: {
      View: (props: Props) => {
        animated.push(props.style as StyleProp<ViewStyle>);
        return h('div', null, props.children);
      },
    },
    useAnimatedStyle: (updater: () => ViewStyle) => updater(),
    useAnimatedReaction: vi.fn(),
  };
});

vi.mock('react-native-worklets', () => ({ scheduleOnRN: vi.fn() }));

vi.mock('./IconGlyph.tsx', () => ({ IconGlyph: () => null }));

const { StyleSheet } = await import('react-native');

const PROGRESS = 0.42;
const handlers = {
  onOpen: vi.fn(),
  onTogglePlay: vi.fn(),
  onClose: vi.fn(),
};

function render(playing: number) {
  pressables.length = 0;
  animated.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <MiniPlayerBar
        title="Everlong"
        detail="Foo Fighters · Click on"
        progress={{ value: PROGRESS } as never}
        playing={{ value: playing } as never}
        openLabel="Open Everlong"
        playLabel="Play Everlong"
        pauseLabel="Pause Everlong"
        closeLabel="Stop Everlong"
        bottomInset={0}
        {...handlers}
      />
    </ThemeProvider>,
  );
}

function pressable(label: string): Props {
  const found = pressables.find((p) => p.accessibilityLabel === label);
  if (found === undefined) throw new Error(`no control labelled ${label}`);
  return found;
}

const flat = (style: unknown) =>
  StyleSheet.flatten(style as StyleProp<ViewStyle>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MiniPlayerBar', () => {
  it('gives every control at least the minimum touch target', () => {
    render(0);
    expect(pressables).toHaveLength(3);
    for (const props of pressables) {
      const style = flat(props.style);
      expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(
        minTouchTargetDp,
      );
    }
    for (const label of ['Play Everlong', 'Stop Everlong'])
      expect(flat(pressable(label).style).width).toBeGreaterThanOrEqual(
        minTouchTargetDp,
      );
  });

  it.each([
    ['Open Everlong', 'onOpen'],
    ['Play Everlong', 'onTogglePlay'],
    ['Stop Everlong', 'onClose'],
  ] as const)('routes %s to %s', (label, handler) => {
    render(0);
    (pressable(label).onPress as () => void)();
    expect(handlers[handler]).toHaveBeenCalledOnce();
  });

  it('draws the progress line from the shared value', () => {
    render(0);
    const scales = animated.map(
      (style) => flat(style).transform?.[0] as { scaleX?: number } | undefined,
    );
    expect(scales).toContainEqual({ scaleX: PROGRESS });
  });

  it.each([
    [0, [1, 0]],
    [1, [0, 1]],
  ])('shows play, then pause, by the playing flag %d', (playing, shown) => {
    render(playing);
    const opacities = animated
      .map((style) => flat(style).opacity)
      .filter((opacity) => opacity !== undefined);
    expect(opacities).toEqual(shown);
  });
});
