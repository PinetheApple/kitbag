// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

import { drawn, drawnAs, liveProps } from './svgRecorder.test-helper.ts';
import { Waveform } from './Waveform.tsx';

const MEASURED_WIDTH = 300;
const HEIGHT = 10;

const animated = vi.hoisted(() => [] as unknown[]);

vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: <T,>(styles: T) => styles, absoluteFill: {} },
}));
vi.mock('../ThemeProvider.tsx', () => ({
  useTheme: () => ({ color: { wave: 'wave', waveHot: 'waveHot' } }),
}));
vi.mock('react-native-reanimated', async () => {
  const { live } = await import('./svgRecorder.test-helper.ts');
  return {
    default: {
      View: (props: unknown) => {
        animated.push(props);
        return null;
      },
      createAnimatedComponent: <T,>(component: T) => component,
    },
    useAnimatedProps: live,
  };
});
vi.mock(
  'react-native-svg',
  async () => (await import('./svgRecorder.test-helper.ts')).svg,
);

beforeEach(() => {
  animated.length = 0;
  drawn.length = 0;
});

function mount(bars: number, progress: { value: number }) {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <Waveform
        envelope={[1, 0.5]}
        bars={bars}
        height={HEIGHT}
        progress={progress as never}
      />,
    );
  });
  if (tree === undefined) throw new Error('Waveform did not mount');
  return tree;
}

function measure(tree: ReactTestRenderer) {
  const lane = tree.root.find((node) => node.props.onLayout !== undefined);
  act(() => {
    (lane.props.onLayout as (event: object) => void)({
      nativeEvent: { layout: { width: MEASURED_WIDTH } },
    });
  });
}

function playhead() {
  const gradient = drawnAs('LinearGradient').at(-1);
  if (gradient === undefined) throw new Error('no played edge was drawn');
  return liveProps(gradient).x1;
}

it('draws the lane on one svg hidden from readers, with no animated view', () => {
  const tree = mount(2, { value: 0.5 });
  drawn.length = 0;
  measure(tree);
  expect(animated).toEqual([]);
  expect(drawnAs('Svg')).toEqual([
    expect.objectContaining({
      accessible: false,
      importantForAccessibility: 'no-hide-descendants',
      accessibilityElementsHidden: true,
    }),
  ]);
});

it('puts the played edge at the left on a paused remount before the lane is measured', () => {
  mount(2, { value: 0 });
  expect(playhead()).toBe(0);
});

it('puts the played edge at the progress share of the measured lane', () => {
  measure(mount(2, { value: 0.25 }));
  expect(playhead()).toBe(MEASURED_WIDTH / 4);
});

it('follows the shared value through the animated edge props', () => {
  const progress = { value: 0.25 };
  measure(mount(2, progress));
  progress.value = 1;
  expect(playhead()).toBe(MEASURED_WIDTH);
});

it.each([64, 2])('draws the lane as one shape with %d bars', (bars) => {
  const tree = mount(bars, { value: 0.5 });
  drawn.length = 0;
  measure(tree);
  expect(drawnAs('Path')).toHaveLength(1);
});

it('fills the bars from the played edge once the lane is measured', () => {
  const tree = mount(2, { value: 0.5 });
  expect(drawnAs('Path')).toEqual([]);
  drawn.length = 0;
  measure(tree);
  const [bars] = drawnAs('Path');
  const gradient = drawnAs('LinearGradient').at(-1);
  expect(bars?.d).toMatch(/^M.+Z$/);
  expect(bars?.fill).toBe(`url(#${String(gradient?.id)})`);
  expect(drawnAs('Stop').slice(-2)).toEqual([
    { offset: 0, stopColor: 'waveHot' },
    { offset: 1, stopColor: 'wave' },
  ]);
});
