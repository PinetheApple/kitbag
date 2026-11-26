// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import { create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTheme } from '../theme.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { CountSquare } from './CountSquare.tsx';
import { drawn, drawnAs, liveProps } from './svgRecorder.test-helper.ts';

const styles = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: <T,>(sheet: T) => sheet, absoluteFill: {} },
  useColorScheme: () => 'dark',
}));
vi.mock(
  'react-native-svg',
  async () => (await import('./svgRecorder.test-helper.ts')).svg,
);
vi.mock('react-native-reanimated', async () => {
  const { live } = await import('./svgRecorder.test-helper.ts');
  return {
    default: {
      View: 'Animated.View',
      Text: 'Animated.Text',
      createAnimatedComponent: <T,>(component: T) => component,
    },
    useAnimatedProps: live,
    useAnimatedStyle: (build: () => Record<string, unknown>) => {
      const style = build();
      styles.push(style);
      return style;
    },
  };
});

const { color } = buildTheme('dark');
const BEAT = 1;
const SIDE = 56;

function shownInk(currentBeat: number): unknown[] {
  drawn.length = 0;
  styles.length = 0;
  act(() => {
    create(
      <ThemeProvider mode="dark">
        <CountSquare
          beat={BEAT}
          side={SIDE}
          currentBeat={{ value: currentBeat } as never}
        />
      </ThemeProvider>,
    );
  });
  return drawnAs('SvgText')
    .filter((text) => liveProps(text).opacity === 1)
    .map((text) => text.fill);
}

beforeEach(() => {
  drawn.length = 0;
});

describe('CountSquare', () => {
  it.each([
    ['upcoming', BEAT - 1, color.text2],
    ['now', BEAT, color.bg],
    ['done', BEAT + 1, color.text3],
  ])('draws its %s digit as svg in that ink only', (_state, current, ink) => {
    expect(shownInk(current)).toEqual([ink]);
    expect(drawnAs('SvgText').map((text) => text.children)).toEqual(
      Array.from({ length: 3 }, () => String(BEAT + 1)),
    );
  });

  it('moves only View colours between beats, which Android does not report', () => {
    for (const current of [BEAT - 1, BEAT, BEAT + 1]) {
      shownInk(current);
      for (const style of styles)
        expect(Object.keys(style).sort()).toEqual([
          'backgroundColor',
          'borderColor',
        ]);
    }
  });
});
