import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTheme } from '../theme.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { MiniPlayerBar } from './MiniPlayerBar.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';
import { drawn, drawnAs, liveProps } from './svgRecorder.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const pressables = vi.hoisted(() => [] as Props[]);
const views = vi.hoisted(() => [] as Props[]);
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
    View: (props: Props) => {
      views.push(props);
      return h('div', null, props.children);
    },
  };
});

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  const { live } = await import('./svgRecorder.test-helper.ts');
  return {
    default: {
      View: (props: Props) => {
        animated.push(props.style as StyleProp<ViewStyle>);
        return h('div', null, props.children);
      },
      createAnimatedComponent: <T,>(component: T) => component,
    },
    useAnimatedStyle: (updater: () => ViewStyle) => updater(),
    useAnimatedProps: live,
    useAnimatedReaction: vi.fn(),
    useDerivedValue: live,
    useSharedValue: (value: unknown) => ({ value }),
  };
});

vi.mock('react-native-worklets', () => ({ scheduleOnRN: vi.fn() }));

vi.mock('./IconGlyph.tsx', () => ({ IconGlyph: () => null }));
vi.mock(
  'react-native-svg',
  async () => (await import('./svgRecorder.test-helper.ts')).svg,
);

const PROGRESS = 0.42;
const LATER = 0.6;
const LINE_WIDTH = 320;
const progress = { value: PROGRESS };
const handlers = {
  onOpen: vi.fn(),
  onQueue: vi.fn(),
  onTogglePlay: vi.fn(),
  onClose: vi.fn(),
};

function render(playing: number) {
  pressables.length = 0;
  views.length = 0;
  animated.length = 0;
  drawn.length = 0;
  progress.value = PROGRESS;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <MiniPlayerBar
        tile="song"
        title="Everlong"
        detail="Foo Fighters · Click on"
        progress={progress as never}
        playing={{ value: playing } as never}
        openLabel="Open Everlong"
        playLabel="Play Everlong"
        pauseLabel="Pause Everlong"
        closeLabel="Stop Everlong"
        queueLabel="Queue, 2 up next"
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

function measureLine() {
  const line = views.find((props) => props.onLayout !== undefined);
  (line?.onLayout as (event: object) => void)({
    nativeEvent: { layout: { width: LINE_WIDTH, height: 2 } },
  });
}

const flat = (style: unknown) => flatStyle(style as StyleProp<ViewStyle>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MiniPlayerBar', () => {
  it('gives every control at least the minimum touch target', () => {
    render(0);
    expect(pressables).toHaveLength(4);
    for (const props of pressables) {
      const style = flat(props.style);
      expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(
        minTouchTargetDp,
      );
    }
    for (const label of ['Queue, 2 up next', 'Play Everlong', 'Stop Everlong'])
      expect(flat(pressable(label).style).width).toBeGreaterThanOrEqual(
        minTouchTargetDp,
      );
  });

  it.each([
    ['Open Everlong', 'onOpen'],
    ['Queue, 2 up next', 'onQueue'],
    ['Play Everlong', 'onTogglePlay'],
    ['Stop Everlong', 'onClose'],
  ] as const)('routes %s to %s', (label, handler) => {
    render(0);
    (pressable(label).onPress as () => void)();
    expect(handlers[handler]).toHaveBeenCalledOnce();
  });

  it('draws the progress line on an svg from the shared value', () => {
    render(0);
    const transforms = animated.map((style) => flat(style).transform);
    expect(transforms.filter((t) => t !== undefined)).toEqual([]);
    expect(drawnAs('Svg')).toHaveLength(1);
    measureLine();
    const fill = () => liveProps(drawnAs('Rect')[0]);
    expect(fill()).toMatchObject({
      width: LINE_WIDTH * PROGRESS,
      fill: buildTheme('dark').color.accent,
    });
    progress.value = LATER;
    expect(fill().width).toBe(LINE_WIDTH * LATER);
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
