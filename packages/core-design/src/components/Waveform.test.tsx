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
    useAnimatedStyle: (updater: () => object) => updater(),
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

function playedClip() {
  const clip = drawnAs('ClipPath').at(-1);
  const played = drawnAs('G').at(-1);
  if (clip === undefined || played === undefined)
    throw new Error('no played layer was drawn');
  expect(played.clipPath).toBe(`url(#${String(clip.id)})`);
  const rect = drawnAs('Rect').at(-1);
  return { width: liveProps(rect).width, height: rect?.height };
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

it('draws nothing played on a paused remount before the lane is measured', () => {
  mount(2, { value: 0 });
  expect(playedClip().width).toBe(0);
});

it('clips the played layer to the progress share of the measured lane', () => {
  measure(mount(2, { value: 0.25 }));
  expect(playedClip()).toEqual({
    width: MEASURED_WIDTH / 4,
    height: HEIGHT,
  });
});

it('follows the shared value through the animated clip props', () => {
  const progress = { value: 0.25 };
  measure(mount(2, progress));
  progress.value = 1;
  expect(playedClip().width).toBe(MEASURED_WIDTH);
});

it.each([64, 2])('draws each layer as one shape with %d bars', (bars) => {
  const tree = mount(bars, { value: 0.5 });
  drawn.length = 0;
  measure(tree);
  expect(drawnAs('Path')).toHaveLength(2);
});

it('draws the bars on both layers once the lane is measured', () => {
  const tree = mount(2, { value: 0.5 });
  expect(drawnAs('Path')).toEqual([]);
  drawn.length = 0;
  measure(tree);
  const layers = drawnAs('Path');
  for (const layer of layers) expect(layer.d).toMatch(/^M.+Z$/);
  expect(layers.map((layer) => layer.fill)).toEqual(['wave', 'waveHot']);
});
