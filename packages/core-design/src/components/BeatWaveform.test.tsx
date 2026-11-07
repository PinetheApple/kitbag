import type { ReactElement } from 'react';
import { expect, it, vi } from 'vitest';

const WAVEFORM_WIDTH = 359;

type TapEnd = (event: { readonly x: number }, success: boolean) => void;

const harness = vi.hoisted(() => ({
  width: 0,
  tapEnd: undefined as TapEnd | undefined,
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useCallback: <T,>(fn: T) => fn,
  useMemo: <T,>(factory: () => T) => factory(),
  useState: () => [
    harness.width,
    (width: number) => {
      harness.width = width;
    },
  ],
}));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('react-native-gesture-handler', () => {
  const chain = {
    runOnJS: () => chain,
    onEnd: (handler: TapEnd) => {
      harness.tapEnd = handler;
      return chain;
    },
  };
  return { Gesture: { Tap: () => chain }, GestureDetector: 'GestureDetector' };
});
vi.mock('../ThemeProvider.tsx', () => ({
  createThemedStyles: () => () => ({ lane: {}, ticks: {} }),
  useTheme: () => ({ color: { text: 'tall', text3: 'short' } }),
}));
vi.mock('./Waveform.tsx', () => ({ Waveform: 'Waveform' }));

const { BeatWaveform } = await import('./BeatWaveform.tsx');

interface Lane {
  readonly props: {
    readonly onLayout: (event: {
      readonly nativeEvent: { readonly layout: { readonly width: number } };
    }) => void;
  };
}

function render(onTap: (x: number, width: number) => void) {
  const detector = BeatWaveform({
    envelope: null,
    progress: { value: 0 } as never,
    beats: [],
    downbeatIndices: [],
    durationSec: 10,
    onTap,
  }) as ReactElement<{ readonly children: Lane }>;
  return detector.props.children;
}

it('reports a tap against the width its own layout measured', () => {
  const onTap = vi.fn();
  render(onTap).props.onLayout({
    nativeEvent: { layout: { width: WAVEFORM_WIDTH } },
  });
  render(onTap);
  harness.tapEnd?.({ x: WAVEFORM_WIDTH / 2 }, true);
  expect(onTap).toHaveBeenCalledExactlyOnceWith(
    WAVEFORM_WIDTH / 2,
    WAVEFORM_WIDTH,
  );
});

it('ignores a tap the gesture did not finish', () => {
  const onTap = vi.fn();
  render(onTap);
  harness.tapEnd?.({ x: 1 }, false);
  expect(onTap).not.toHaveBeenCalled();
});
