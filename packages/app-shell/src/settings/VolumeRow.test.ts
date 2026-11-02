import { releaseTarget, type SliderMode } from '@kitbag/core-design';
import { KB_VOLUME_BOUNDS } from '@kitbag/core-native';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { VOLUME_SLIDER, volumePercent } from './rigVolume.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const sliders = vi.hoisted(() => [] as Props[]);
const readouts = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  return {
    View: (props: Props) => h('div', null, props.children),
    useWindowDimensions: () => ({ fontScale: 1 }),
  };
});

vi.mock('react-native-reanimated', () => ({
  useSharedValue: (value: unknown) => ({ value }),
}));

vi.mock('@kitbag/core-state', () => ({
  useMetronome: (select: (state: object) => unknown) =>
    select({ volume: 1, setVolume: () => undefined }),
}));

vi.mock('./rigRuntime', () => ({ setLiveVolume: () => undefined }));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const pure = await original<Record<string, unknown>>();
  return {
    ...pure,
    EditRow: (props: Props) => h('div', null, props.children),
    LiveText: () => null,
    LiveSlot: (props: Props) => {
      readouts.push(props);
      return null;
    },
    Slider: (props: Props) => {
      sliders.push(props);
      return null;
    },
    createThemedStyles: (factory: (theme: object) => object) => () =>
      factory({ color: new Proxy({}, { get: () => '' }) }),
  };
});

const { VolumeRow } = await import('./VolumeRow.tsx');

describe('click volume row wiring', () => {
  it('gives the slider the mode that sets the level on a tap', () => {
    sliders.length = 0;
    renderToStaticMarkup(createElement(VolumeRow));
    const mode = sliders[0]?.mode as SliderMode;
    expect(mode).toBe(VOLUME_SLIDER.mode);
    expect(releaseTarget(mode, 'tap', true, 0.25, 0.5)).toBe(0.25);
  });

  it('sizes the readout by the widest level it can show, not a fixed width', () => {
    readouts.length = 0;
    renderToStaticMarkup(createElement(VolumeRow));
    expect(readouts[0]?.widest).toBe(volumePercent(KB_VOLUME_BOUNDS.max));
    expect(readouts[0]?.style).not.toHaveProperty('width');
  });
});
