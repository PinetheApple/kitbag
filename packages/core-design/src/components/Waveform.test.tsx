// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

import { drawn, drawnAs } from './skiaRecorder.test-helper.ts';
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
  const { derived } = await import('./skiaRecorder.test-helper.ts');
  return {
    default: {
      View: (props: unknown) => {
        animated.push(props);
        return null;
      },
    },
    useAnimatedStyle: (updater: () => object) => updater(),
    useDerivedValue: derived,
  };
});
vi.mock(
  '@shopify/react-native-skia',
  async () => (await import('./skiaRecorder.test-helper.ts')).skia,
);
vi.mock('./FrameCanvas', async () => await import('./FrameCanvas.tsx'));

interface Clip {
  readonly value: { readonly width: number; readonly height: number };
}

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

function playedClip(): Clip {
  const clip = drawnAs('Group').at(-1)?.clip as Clip | undefined;
  if (clip === undefined) throw new Error('no played layer was drawn');
  return clip;
}

it('draws the lane on one canvas hidden from readers, with no animated view', () => {
  const tree = mount(2, { value: 0.5 });
  drawn.length = 0;
  measure(tree);
  expect(animated).toEqual([]);
  expect(drawnAs('Canvas')).toEqual([
    expect.objectContaining({
      accessible: false,
      importantForAccessibility: 'no-hide-descendants',
      accessibilityElementsHidden: true,
    }),
  ]);
});

it('draws nothing played on a paused remount before the lane is measured', () => {
  mount(2, { value: 0 });
  expect(playedClip().value.width).toBe(0);
});

it('clips the played layer to the progress share of the measured lane', () => {
  measure(mount(2, { value: 0.25 }));
  expect(playedClip().value).toEqual({
    x: 0,
    y: 0,
    width: MEASURED_WIDTH / 4,
    height: HEIGHT,
  });
});

it('follows the shared value on the canvas with no render', () => {
  const progress = { value: 0.25 };
  measure(mount(2, progress));
  const clip = playedClip();
  const renders = drawn.length;
  progress.value = 1;
  expect(clip.value.width).toBe(MEASURED_WIDTH);
  expect(drawn.length).toBe(renders);
});

it('draws each layer as one shape however many bars it has', () => {
  measure(mount(64, { value: 0.5 }));
  const many = drawnAs('Path').slice(-2);
  measure(mount(2, { value: 0.5 }));
  const few = drawnAs('Path').slice(-2);
  expect(many).toHaveLength(2);
  expect(few).toHaveLength(2);
});

it('draws the bars on both layers once the lane is measured', () => {
  const tree = mount(2, { value: 0.5 });
  expect(drawnAs('Path')).toEqual([]);
  measure(tree);
  const drawnPaths = drawnAs('Path')
    .slice(-2)
    .map((props) => props.path);
  expect(drawnPaths.map((d) => typeof d)).toEqual(['string', 'string']);
  for (const d of drawnPaths) expect(d).toMatch(/^M.+Z$/);
  expect(
    drawnAs('Path')
      .slice(-2)
      .map((props) => props.color),
  ).toEqual(['wave', 'waveHot']);
});
