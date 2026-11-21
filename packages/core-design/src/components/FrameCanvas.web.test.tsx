// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, type ReactElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FillBar, ThumbDot, WaveLayers } from './FrameCanvas.web.tsx';

type Live = () => Record<string, unknown>;

const animated = vi.hoisted(() => [] as Live[]);

vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: <T,>(styles: T) => styles, absoluteFill: {} },
}));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  return {
    default: {
      View: (props: { style: unknown[]; children?: ReactNode }) => {
        const live = props.style.at(-1) as { live: Live };
        animated.push(live.live);
        return h('AnimatedView', null, props.children);
      },
    },
    useAnimatedStyle: (updater: Live) => ({ live: updater }),
    useSharedValue: (value: unknown) => ({ value }),
  };
});

const DIAMETER = 12;
const TRACK = 200;

beforeEach(() => {
  animated.length = 0;
});

function mount(element: ReactElement): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(element);
  });
  if (tree === undefined) throw new Error('nothing mounted');
  return tree;
}

describe('web FrameCanvas', () => {
  it('scales the fill and colours it from the shared values', () => {
    const progress = { value: 0.25 };
    const color = { value: 'accent' };
    mount(
      <FillBar
        progress={progress as never}
        color={color as never}
        style={{}}
      />,
    );
    const [fill] = animated;
    expect(fill?.()).toEqual({
      transform: [{ scaleX: 0.25 }],
      backgroundColor: 'accent',
    });
    progress.value = 3;
    color.value = 'red';
    expect(fill?.()).toEqual({
      transform: [{ scaleX: 1 }],
      backgroundColor: 'red',
    });
  });

  it('moves the thumb across the measured track and holds it before layout', () => {
    const progress = { value: 0.5 };
    const tree = mount(
      <ThumbDot
        progress={progress as never}
        color="text"
        diameter={DIAMETER}
        style={{}}
      />,
    );
    const [thumb] = animated;
    expect(thumb?.()).toEqual({ transform: [{ translateX: 0 }] });
    const lane = tree.root.find((node) => node.props.onLayout !== undefined);
    act(() => {
      (lane.props.onLayout as (event: object) => void)({
        nativeEvent: { layout: { width: TRACK + DIAMETER, height: DIAMETER } },
      });
    });
    expect(thumb?.()).toEqual({ transform: [{ translateX: TRACK / 2 }] });
  });

  it('counter-slides the played clip and its content by the unplayed share', () => {
    mount(
      <WaveLayers
        path="M0 0Z"
        width={TRACK}
        height={DIAMETER}
        color="wave"
        playedColor="waveHot"
        progress={{ value: 0.25 } as never}
      />,
    );
    expect(animated.map((live) => live())).toEqual([
      { transform: [{ translateX: '-75%' }] },
      { transform: [{ translateX: '75%' }] },
    ]);
  });
});
