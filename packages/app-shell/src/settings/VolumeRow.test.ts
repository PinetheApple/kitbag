import { releaseTarget, type SliderMode } from '@kitbag/core-design';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { VOLUME_SLIDER } from './rigVolume.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const sliders = vi.hoisted(() => [] as Props[]);

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
    Slider: (props: Props) => {
      sliders.push(props);
      return null;
    },
    createThemedStyles: () => () => new Proxy({}, { get: () => ({}) }),
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
});
