import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { Slider } from './Slider.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const hitAreas = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    View: (props: Props) => {
      if (props.accessibilityRole === 'adjustable') hitAreas.push(props);
      return h('div', null, props.children);
    },
  };
});

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  return {
    default: { View: (props: Props) => h('div', null, props.children) },
    useAnimatedStyle: () => ({}),
    useSharedValue: (value: unknown) => ({ value }),
  };
});

vi.mock('react-native-gesture-handler', async () => {
  const { createElement: h, Fragment } = await import('react');
  const chain: object = new Proxy({}, { get: () => () => chain });
  return {
    Gesture: { Pan: () => chain, Tap: () => chain, Race: () => chain },
    GestureDetector: (props: Props) => h(Fragment, null, props.children),
  };
});

vi.mock('react-native-worklets', () => ({ scheduleOnRN: vi.fn() }));

const { StyleSheet } = await import('react-native');

function hitArea(): ViewStyle {
  hitAreas.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <Slider
        value={{ value: 0.5 } as never}
        onRelease={vi.fn()}
        accessibilityLabel="Click volume"
        accessibilityValue="50%"
        step={0.05}
        mode="fader"
      />
    </ThemeProvider>,
  );
  return StyleSheet.flatten(hitAreas[0]?.style as StyleProp<ViewStyle>);
}

describe('Slider hit area', () => {
  it('keeps the touch height in a column parent as well as a row', () => {
    const style = hitArea();
    expect(style.height).toBe(minTouchTargetDp);
    expect(style.flexGrow ?? 0).toBe(0);
    expect(style.width).toBe('100%');
  });
});
