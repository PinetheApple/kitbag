import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import {
  SegmentedControl,
  type SegmentedControlSize,
} from './SegmentedControl.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ fontScale: 1 }));
const rendered = vi.hoisted(() => ({
  track: [] as Props[],
  options: [] as Props[],
}));

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const View = actual.View as (props: Props) => ReactNode;
  return {
    ...actual,
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
    View: (props: Props) => {
      if (props.accessibilityRole === 'radiogroup') rendered.track.push(props);
      return createElement(View, props);
    },
    Pressable: (props: Props) => {
      rendered.options.push(props);
      return createElement('div', null, props.children);
    },
  };
});

const { StyleSheet } = await import('react-native');

const OPTIONS = [
  { value: 'same', label: 'Same' },
  { value: 'distinct', label: 'Distinct' },
] as const;

const SIZES: readonly SegmentedControlSize[] = [
  'default',
  'large',
  'inline',
  'editRow',
  'row',
];

function flat(props: Props | undefined): ViewStyle {
  return StyleSheet.flatten(props?.style as StyleProp<ViewStyle>);
}

function renderAt(fontScale: number, size: SegmentedControlSize, fill = true) {
  display.fontScale = fontScale;
  rendered.track.length = 0;
  rendered.options.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <SegmentedControl
        size={size}
        fill={fill}
        accessibilityLabel="Count-in sound"
        options={OPTIONS}
        selected="same"
        onSelect={vi.fn()}
      />
    </ThemeProvider>,
  );
  return {
    track: flat(rendered.track[0]),
    options: rendered.options.map(flat),
  };
}

describe('SegmentedControl under font scale', () => {
  it('shares the track out equally at the default text size', () => {
    const { track, options } = renderAt(1, 'large');
    expect(track.flexWrap).toBeUndefined();
    for (const option of options) expect(option.flex).toBe(1);
  });

  it('never shrinks an option below its label once the text grows', () => {
    for (const size of SIZES) {
      for (const fill of [true, false]) {
        const { options } = renderAt(2, size, fill);
        for (const option of options) {
          expect(option.flex).toBeUndefined();
          expect(option.flexShrink ?? 0).toBe(0);
        }
      }
    }
  });

  it('wraps options onto further rows inside the track once the text grows', () => {
    for (const size of SIZES) {
      expect(renderAt(2, size).track.flexWrap).toBe('wrap');
    }
  });

  it('lets a filling track shrink to its line so its options wrap', () => {
    const { track } = renderAt(2, 'large');
    expect(track.flex).toBeUndefined();
    expect(track.flexShrink).toBe(1);
  });
});
