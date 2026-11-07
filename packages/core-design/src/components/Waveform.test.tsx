import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { Waveform } from './Waveform.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const animated = vi.hoisted(() => [] as StyleProp<ViewStyle>[]);

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  return {
    default: {
      View: (props: Props) => {
        animated.push(props.style as StyleProp<ViewStyle>);
        return h('div', null, props.children);
      },
    },
    useAnimatedStyle: (updater: () => ViewStyle) => updater(),
  };
});

function mountedShift(progress: number) {
  animated.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <Waveform
        envelope={[1, 1]}
        bars={2}
        height={10}
        progress={{ value: progress } as never}
      />
    </ThemeProvider>,
  );
  return animated.map(
    (style) => StyleSheet.flatten(style).transform?.[0] as object,
  );
}

it('draws nothing played on a paused remount before the lane is measured', () => {
  expect(mountedShift(0)).toEqual([
    { translateX: '-100%' },
    { translateX: '100%' },
  ]);
});

it('draws the played share of the lane from the first frame', () => {
  expect(mountedShift(0.25)).toEqual([
    { translateX: '-75%' },
    { translateX: '75%' },
  ]);
  expect(mountedShift(1)).toEqual([{ translateX: '0%' }, { translateX: '0%' }]);
});
