import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const ANALYSED_BPM = 171.6;

const drawn = vi.hoisted(() => ({
  keypad: [] as Props[],
  readouts: [] as Props[],
  presets: [] as Props[],
}));
const ladder = vi.hoisted(() => ({
  bpm: 0,
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

beforeEach(() => {
  vi.clearAllMocks();
  ladder.bpm = ANALYSED_BPM;
});

it('closes without setting a tempo when nothing was typed', () => {
  const onDismiss = render();
  const [keypad] = drawn.keypad;
  (keypad?.onConfirm as () => void)();
  expect(ladder.enter).not.toHaveBeenCalled();
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
