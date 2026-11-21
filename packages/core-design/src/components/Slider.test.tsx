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
import { drawn, drawnAs, liveProps } from './svgRecorder.test-helper.ts';

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
  const { live } = await import('./svgRecorder.test-helper.ts');
  return {
    default: {
      View: (props: Props) => {
        animated.push(props);
        return h('div', null, props.children);
      },
      createAnimatedComponent: <T,>(component: T) => component,
    },
    useAnimatedProps: live,
    useSharedValue: (value: unknown) => ({ value }),
    useDerivedValue: live,
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
  'react-native-svg',
  async () => (await import('./svgRecorder.test-helper.ts')).svg,
);

const DARK = buildTheme('dark');
const TRACK_WIDTH = 200;
const WARN_ABOVE = 0.8;

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

function measureLanes() {
  const { thumb } = sliderGeometry.fader;
  const [fill, dot] = views.filter(
    (props) =>
      props.onLayout !== undefined &&
      props.importantForAccessibility === 'no-hide-descendants',
  );
  (fill?.onLayout as (event: object) => void)({
    nativeEvent: { layout: { width: TRACK_WIDTH, height: thumb } },
  });
  (dot?.onLayout as (event: object) => void)({
    nativeEvent: { layout: { width: TRACK_WIDTH + thumb, height: thumb } },
  });
}

const fillRect = () => drawnAs('Rect')[0];
const thumbCircle = () => drawnAs('Circle')[0];

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
  it('draws fill and thumb on svgs hidden from readers, not animated views', () => {
    render({ value: 0.5 });
    expect(animated).toEqual([]);
    expect(drawnAs('Svg')).toHaveLength(2);
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

  it('squashes the fill and moves the thumb from the shared value', () => {
    const value = { value: 0.5 };
    render(value);
    measureLanes();
    const { thumb } = sliderGeometry.fader;
    const corner = fillRect()?.ry as number;
    expect(corner).toBeGreaterThan(0);
    expect(liveProps(fillRect())).toMatchObject({
      width: TRACK_WIDTH / 2,
      rx: corner / 2,
    });
    expect(liveProps(thumbCircle()).cx).toBe(thumb / 2 + TRACK_WIDTH / 2);
    value.value = 2;
    expect(liveProps(fillRect())).toMatchObject({
      width: TRACK_WIDTH,
      rx: corner,
    });
    expect(liveProps(thumbCircle()).cx).toBe(thumb / 2 + TRACK_WIDTH);
  });

  it('keeps the thumb on its svg before the lane is measured', () => {
    render({ value: 1 });
    expect(liveProps(thumbCircle()).cx).toBe(sliderGeometry.fader.thumb / 2);
  });

  it('shows the warning colour over the fill past the warning point', () => {
    const value = { value: 0.5 };
    render(value, WARN_ABOVE);
    const [fill, warning] = drawnAs('Rect');
    expect(fill?.fill).toBe(DARK.color.accent);
    expect(warning?.fill).toBe(DARK.color.red);
    expect(liveProps(warning).opacity).toBe(0);
    value.value = 0.9;
    expect(liveProps(warning).opacity).toBe(1);
  });

  it('draws no warning layer without a warning point', () => {
    render({ value: 0.9 });
    expect(drawnAs('Rect')).toHaveLength(1);
  });
});
