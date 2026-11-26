// react-test-renderer is deprecated, but it alone re-renders on state with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { create } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

import { TAPS_TO_SET_TEMPO } from '@kitbag/core-state';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const ANALYSED_BPM = 171.6;
const DEFAULT_BPM = 120;
const TYPED_DIGITS = [9, 6];
const TYPED_BPM = 96;
const TAPPED_BPM = 88;
const TWO_TAPS = 2;
const TOUCH_UPTIME_MS = 3000;
const DEEP_SLEEP_GAP_MS = 60_000;

const drawn = vi.hoisted(() => ({
  keypad: [] as Props[],
  readouts: [] as Props[],
  presets: [] as Props[],
}));
interface PlayAlongView {
  bpm: number | undefined;
  lock: object | undefined;
  setBpm: ReturnType<typeof vi.fn>;
}
const playAlong = vi.hoisted((): PlayAlongView => ({
  bpm: 0,
  lock: undefined,
  setBpm: vi.fn(),
}));
interface LadderView {
  bpm: number | null;
  source: string | null;
  tapsLanded: number;
  enter: ReturnType<typeof vi.fn>;
  tap: ReturnType<typeof vi.fn>;
  halve: ReturnType<typeof vi.fn>;
  double: ReturnType<typeof vi.fn>;
}
const ladder = vi.hoisted((): LadderView => ({
  bpm: null,
  source: null,
  tapsLanded: 0,
  enter: vi.fn(),
  tap: vi.fn(),
  halve: vi.fn(),
  double: vi.fn(),
}));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return {
    View: host,
    Text: host,
    Pressable: host,
    ScrollView: host,
    AppState: { addEventListener: () => ({ remove: () => undefined }) },
    StyleSheet: { create: <T,>(styles: T) => styles },
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useTempoLadder: <T,>(selector: (state: typeof ladder) => T) =>
    selector(ladder),
  tempoLadderStore: { getState: () => ladder },
}));

vi.mock('@kitbag/core-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  uptimeToBoottimeMs: (uptimeMs: number) => uptimeMs + DEEP_SLEEP_GAP_MS,
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const capture = (into: Props[]) => (props: Props) => {
    into.push(props);
    return null;
  };
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    Sheet: (props: Props) => h('section', null, props.children),
    NumpadKeypad: capture(drawn.keypad),
    NumpadReadout: capture(drawn.readouts),
    PresetButton: capture(drawn.presets),
  };
});

vi.mock('./TapPad.tsx', () => ({ TapLeds: () => null }));
vi.mock('./playAlongHooks.ts', () => ({
  usePlayAlong: <T,>(selector: (state: typeof playAlong) => T) =>
    selector(playAlong),
}));

const { TempoSheet } = await import('./TempoSheet.tsx');

function render(onDismiss = vi.fn()) {
  drawn.keypad.length = 0;
  drawn.readouts.length = 0;
  drawn.presets.length = 0;
  renderToStaticMarkup(
    createElement(TempoSheet, {
      visible: true,
      sourceWords: 'via your library',
      bottomInset: 0,
      onDismiss,
    }),
  );
  return onDismiss;
}

function press(preset: string) {
  const button = drawn.presets.find((props) =>
    String(props.label).startsWith(preset),
  );
  (button?.onPress as (event: unknown) => void)({
    nativeEvent: { timestamp: TOUCH_UPTIME_MS },
  });
}

function tapsLand(tapsLanded: number) {
  ladder.tap.mockImplementation(() => {
    ladder.tapsLanded = tapsLanded;
    ladder.source = 'tap';
    ladder.bpm = TAPPED_BPM;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  ladder.bpm = ANALYSED_BPM;
  playAlong.bpm = ANALYSED_BPM;
  playAlong.lock = undefined;
  ladder.source = null;
  ladder.tapsLanded = 0;
});

it('times a sheet tap from its touch', () => {
  render();
  press('Tap');
  expect(ladder.tap).toHaveBeenCalledWith(TOUCH_UPTIME_MS + DEEP_SLEEP_GAP_MS);
});

it('moves a lock once four sheet taps set a tempo', () => {
  playAlong.lock = {};
  tapsLand(TAPS_TO_SET_TEMPO);
  render();
  press('Tap');
  expect(playAlong.setBpm).toHaveBeenCalledWith(TAPPED_BPM);
});

it('waits for the fourth sheet tap before moving a lock', () => {
  playAlong.lock = {};
  tapsLand(TWO_TAPS);
  render();
  press('Tap');
  expect(playAlong.setBpm).not.toHaveBeenCalled();
});

it('leaves four unlocked sheet taps to the ladder', () => {
  tapsLand(TAPS_TO_SET_TEMPO);
  render();
  press('Tap');
  expect(playAlong.setBpm).not.toHaveBeenCalled();
});

it('sets a typed tempo through play along, which also moves a lock', () => {
  playAlong.lock = {};
  act(() => {
    create(
      createElement(TempoSheet, {
        visible: true,
        sourceWords: '',
        bottomInset: 0,
        onDismiss: vi.fn(),
      }),
    );
  });
  for (const digit of TYPED_DIGITS)
    act(() => {
      (drawn.keypad.at(-1)?.onDigit as (digit: number) => void)(digit);
    });
  act(() => {
    (drawn.keypad.at(-1)?.onConfirm as () => void)();
  });
  expect(playAlong.setBpm).toHaveBeenCalledWith(TYPED_BPM);
});

it('halves the default tempo when no song gave the ladder one', () => {
  ladder.bpm = null;
  playAlong.bpm = DEFAULT_BPM;
  render();
  press('÷2');
  expect(playAlong.setBpm).toHaveBeenCalledWith(DEFAULT_BPM / 2);
  expect(ladder.halve).not.toHaveBeenCalled();
});

it('doubles the locked tempo through play along', () => {
  playAlong.lock = {};
  render();
  press('×2');
  expect(playAlong.setBpm).toHaveBeenCalledWith(ANALYSED_BPM * 2);
  expect(ladder.double).not.toHaveBeenCalled();
});

it('halves on the ladder while unlocked so the source stays named', () => {
  render();
  press('÷2');
  expect(ladder.halve).toHaveBeenCalledOnce();
  expect(playAlong.setBpm).not.toHaveBeenCalled();
});

it('closes without setting a tempo when nothing was typed', () => {
  const onDismiss = render();
  const [keypad] = drawn.keypad;
  (keypad?.onConfirm as () => void)();
  expect(playAlong.setBpm).not.toHaveBeenCalled();
  expect(onDismiss).toHaveBeenCalledOnce();
});

it('shows an analysed tempo rounded while the ladder keeps it whole', () => {
  render();
  expect(drawn.readouts[0]?.digits).toBe('172');
  expect(drawn.presets.map((props) => props.label)).toEqual([
    '÷2 · 86',
    '×2 · 343',
    'Tap',
  ]);
  expect(ladder.bpm).toBe(ANALYSED_BPM);
});
