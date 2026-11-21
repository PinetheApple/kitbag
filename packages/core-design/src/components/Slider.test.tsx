import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTheme } from '../theme.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { sliderGeometry } from '../stemPlayerRoles.ts';
import { Slider } from './Slider.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';
import { drawn, drawnAs } from './skiaRecorder.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const views = vi.hoisted(() => [] as Props[]);
const animated = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    View: (props: Props) => {
      views.push(props);
      return h('div', null, props.children);
    },
  };
});

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  const { derived } = await import('./skiaRecorder.test-helper.ts');
  return {
    default: {
      View: (props: Props) => {
        animated.push(props);
        return h('div', null, props.children);
      },
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: (value: unknown) => ({ value }),
    useDerivedValue: derived,
  };
});

vi.mock('react-native-gesture-handler', async () => {
  const { createElement: h, Fragment } = await import('react');
  const chain: object = new Proxy({}, { get: () => () => chain });
  return {
    useCompetingGestures: () => chain,
    usePanGesture: () => chain,
    useTapGesture: () => chain,
    GestureDetector: (props: Props) => h(Fragment, null, props.children),
  };
});

vi.mock('react-native-worklets', () => ({ scheduleOnRN: vi.fn() }));
vi.mock(
  '@shopify/react-native-skia',
  async () => (await import('./skiaRecorder.test-helper.ts')).skia,
);
vi.mock('./FrameCanvas', async () => await import('./FrameCanvas.tsx'));

const DARK = buildTheme('dark');
const TRACK_WIDTH = 200;
const WARN_ABOVE = 0.8;

interface Live<T> {
  readonly value: T;
}

beforeEach(() => {
  views.length = 0;
  animated.length = 0;
  drawn.length = 0;
});

function render(value: { value: number }, warnAbove?: number) {
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <Slider
        value={value as never}
        onRelease={vi.fn()}
        accessibilityLabel="Click volume"
        accessibilityValue="50%"
        step={0.05}
        mode="fader"
        {...(warnAbove === undefined ? {} : { warnAbove })}
      />
    </ThemeProvider>,
  );
}

function hitArea(): ViewStyle {
  render({ value: 0.5 });
  const area = views.find((props) => props.accessibilityRole === 'adjustable');
  return flatStyle(area?.style as StyleProp<ViewStyle>);
}

function measureThumbLane() {
  const { thumb } = sliderGeometry.fader;
  const lane = views.filter((props) => props.onLayout !== undefined).at(-1);
  (lane?.onLayout as (event: object) => void)({
    nativeEvent: { layout: { width: TRACK_WIDTH + thumb, height: thumb } },
  });
}

describe('Slider hit area', () => {
  it('keeps the touch height in a column parent as well as a row', () => {
    const style = hitArea();
    expect(style.height).toBe(minTouchTargetDp);
    expect(style.flexGrow ?? 0).toBe(0);
    expect(style.width).toBe('100%');
  });

  it('keeps the adjustable role, value and actions on the hit area', () => {
    render({ value: 0.5 });
    const area = views.find(
      (props) => props.accessibilityRole === 'adjustable',
    );
    expect(area).toMatchObject({
      accessible: true,
      accessibilityLabel: 'Click volume',
      accessibilityValue: { text: '50%' },
      accessibilityActions: [
        { name: 'increment', label: 'More' },
        { name: 'decrement', label: 'Less' },
      ],
    });
  });
});

describe('Slider drawing', () => {
  it('draws fill and thumb on canvases hidden from readers, not animated views', () => {
    render({ value: 0.5 });
    expect(animated).toEqual([]);
    expect(drawnAs('Canvas')).toHaveLength(2);
    const hidden = views.filter(
      (props) => props.importantForAccessibility === 'no-hide-descendants',
    );
    expect(hidden).toHaveLength(2);
    for (const props of hidden)
      expect(props).toMatchObject({
        accessible: false,
        accessibilityElementsHidden: true,
      });
  });

  it('scales the fill and moves the thumb from the shared value', () => {
    const value = { value: 0.5 };
    render(value);
    measureThumbLane();
    const { thumb } = sliderGeometry.fader;
    const fill = drawnAs('Group')[0]?.transform as Live<object[]>;
    const cx = drawnAs('Circle')[0]?.cx as Live<number>;
    expect(fill.value).toEqual([{ scaleX: 0.5 }]);
    expect(cx.value).toBe(thumb / 2 + TRACK_WIDTH / 2);
    value.value = 2;
    expect(fill.value).toEqual([{ scaleX: 1 }]);
    expect(cx.value).toBe(thumb / 2 + TRACK_WIDTH);
  });

  it('keeps the thumb on its canvas before the lane is measured', () => {
    render({ value: 1 });
    const cx = drawnAs('Circle')[0]?.cx as Live<number>;
    expect(cx.value).toBe(sliderGeometry.fader.thumb / 2);
  });

  it('turns the fill to the warning colour past the warning point', () => {
    const value = { value: 0.5 };
    render(value, WARN_ABOVE);
    const color = drawnAs('RoundedRect')[0]?.color as Live<string>;
    expect(color.value).toBe(DARK.color.accent);
    value.value = 0.9;
    expect(color.value).toBe(DARK.color.red);
  });
});
