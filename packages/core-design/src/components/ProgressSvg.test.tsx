// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, type ReactElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FillBar, ThumbDot, WaveLayers } from './ProgressSvg.tsx';
import { drawn, drawnAs, liveProps } from './svgRecorder.test-helper.ts';

vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: <T,>(styles: T) => styles, absoluteFill: {} },
}));
vi.mock(
  'react-native-svg',
  async () => (await import('./svgRecorder.test-helper.ts')).svg,
);
vi.mock('react-native-reanimated', async () => {
  const { live } = await import('./svgRecorder.test-helper.ts');
  return {
    default: { createAnimatedComponent: <T,>(component: T) => component },
    useAnimatedProps: live,
    useSharedValue: (value: unknown) => ({ value }),
  };
});

const DIAMETER = 12;
const TRACK = 200;
const CORNER = 4;

beforeEach(() => {
  drawn.length = 0;
});

function mount(element: ReactElement): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(element);
  });
  if (tree === undefined) throw new Error('nothing mounted');
  return tree;
}

function measure(tree: ReactTestRenderer, width: number) {
  const lane = tree.root.find((node) => node.props.onLayout !== undefined);
  act(() => {
    (lane.props.onLayout as (event: object) => void)({
      nativeEvent: { layout: { width, height: DIAMETER } },
    });
  });
}

describe('ProgressSvg', () => {
  it('squashes the fill from the left in its static colour', () => {
    const progress = { value: 0.25 };
    const tree = mount(
      <FillBar
        progress={progress as never}
        color="accent"
        radius={CORNER}
        style={{}}
      />,
    );
    measure(tree, TRACK);
    const rects = drawnAs('Rect');
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ ry: CORNER, fill: 'accent' });
    const fill = () => liveProps(drawnAs('Rect').at(-1));
    expect(fill()).toEqual({ width: TRACK / 4, rx: CORNER / 4 });
    progress.value = 3;
    expect(fill()).toEqual({ width: TRACK, rx: CORNER });
  });

  it('shows the warning colour over the fill only while the warning is active', () => {
    const progress = { value: 0.5 };
    const active = { value: false };
    const tree = mount(
      <FillBar
        progress={progress as never}
        color="accent"
        warning={{ color: 'red', active: active as never }}
        radius={CORNER}
        style={{}}
      />,
    );
    measure(tree, TRACK);
    const [base, overlay] = drawnAs('Rect').slice(-2);
    expect(base?.fill).toBe('accent');
    expect(overlay).toMatchObject({ ry: CORNER, fill: 'red' });
    expect(liveProps(overlay)).toEqual({
      width: TRACK / 2,
      rx: CORNER / 2,
      opacity: 0,
    });
    active.value = true;
    expect(liveProps(overlay).opacity).toBe(1);
    expect(liveProps(base)).toEqual({ width: TRACK / 2, rx: CORNER / 2 });
  });

  it('moves the thumb across the measured track and holds it before layout', () => {
    const tree = mount(
      <ThumbDot
        progress={{ value: 0.5 } as never}
        color="text"
        diameter={DIAMETER}
        style={{}}
      />,
    );
    const cx = () => liveProps(drawnAs('Circle').at(-1)).cx;
    expect(cx()).toBe(DIAMETER / 2);
    measure(tree, TRACK + DIAMETER);
    expect(cx()).toBe(DIAMETER / 2 + TRACK / 2);
  });

  it('clips the played layer to the progress share of the lane', () => {
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
    const [clip] = drawnAs('ClipPath');
    expect(drawnAs('G')[0]?.clipPath).toBe(`url(#${String(clip?.id)})`);
    expect(liveProps(drawnAs('Rect')[0])).toEqual({ width: TRACK / 4 });
  });

  it('gives each played clip its own svg-safe id', () => {
    const lane = (
      <WaveLayers
        path="M0 0Z"
        width={TRACK}
        height={DIAMETER}
        color="wave"
        playedColor="waveHot"
        progress={{ value: 0 } as never}
      />
    );
    mount(
      <>
        {lane}
        {lane}
      </>,
    );
    const ids = drawnAs('ClipPath').map((clip) => String(clip.id));
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z_][\w-]*$/);
  });
});
