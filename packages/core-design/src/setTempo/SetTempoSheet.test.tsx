// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, useEffect, type ReactNode } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SeedSource } from './draft.ts';
import { RULES } from './rules.test-helper.ts';
import { SetTempoSheet } from './SetTempoSheet.tsx';
import { SET_TEMPO_COPY } from './text.ts';
import { setTempoKit, useSetTempo, useTempoPreview } from './useSetTempo.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Meter = 3 | 4;

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock('react-native-reanimated', () => ({
  useDerivedValue: (derive: () => unknown) => ({ value: derive() }),
}));
vi.mock('../ThemeProvider.tsx', () => ({
  useTheme: () => ({ accentInk: 'accent' }),
  createThemedStyles: (build: (theme: unknown) => unknown) => () =>
    build({ color: {} }),
}));

const leaf = vi.hoisted(() => (name: string) => {
  function Leaf(props: Props) {
    return createElement(name, props, props.children);
  }
  return Leaf;
});

vi.mock('../components/Sheet.tsx', () => ({
  Sheet: (props: Props) => {
    const { visible, onShow } = props;
    useEffect(() => {
      if (visible === true) (onShow as () => void)();
    }, [visible, onShow]);
    return visible === true
      ? createElement('Sheet', props, props.notice as ReactNode, props.children)
      : null;
  },
}));
vi.mock('../components/Snackbar.tsx', () => ({ Snackbar: leaf('Snackbar') }));
vi.mock('../components/Button.tsx', () => ({ Button: leaf('Button') }));
vi.mock('../components/Chip.tsx', () => ({ Chip: leaf('Chip') }));
vi.mock('../components/Icon.tsx', () => ({ Icon: leaf('Icon') }));
vi.mock('../components/BeatStrip.tsx', () => ({
  BeatStrip: leaf('BeatStrip'),
}));
vi.mock('../components/LiveText.tsx', () => ({ LiveText: leaf('LiveText') }));
vi.mock('../components/Stepper.tsx', () => ({ Stepper: leaf('Stepper') }));
vi.mock('../components/PresetButton.tsx', () => ({
  PresetButton: leaf('PresetButton'),
}));
vi.mock('../components/SegmentedControl.tsx', () => ({
  SegmentedControl: leaf('SegmentedControl'),
}));
vi.mock('../components/NumpadKeypad.tsx', () => ({
  NumpadKeypad: leaf('NumpadKeypad'),
}));
vi.mock('../components/NumpadReadout.tsx', () => ({
  NumpadReadout: leaf('NumpadReadout'),
}));
vi.mock('../components/TapPad.tsx', () => ({
  TapPad: leaf('TapPad'),
  TapLeds: leaf('TapLeds'),
}));
vi.mock('./SetTempoTransport.tsx', () => ({
  SetTempoTransport: leaf('SetTempoTransport'),
}));

const KIT = setTempoKit(RULES);
const PLAYHEAD_SEC = 2.3;
const TAP_GAP_MS = 500;
const NO_SEED: SeedSource<Meter> = {
  manualTempo: null,
  analysedBpm: null,
  barOneSeconds: 0,
  meter: 4,
};
const PLAYHEAD = {
  progress: { value: 0 },
  elapsed: { value: '' },
  second: { value: 0 },
  songSec: { value: PLAYHEAD_SEC },
  playing: { value: 0 },
  hold: vi.fn(),
} as never;
const TRANSPORT = { onTogglePlay: vi.fn(), scrub: {} } as never;

const player = {
  durationSec: 300,
  playheadSeconds: () => PLAYHEAD_SEC,
  setManualTempo: vi.fn(() => Promise.resolve(true)),
  previewTempo: vi.fn(),
};
const callbacks = { onSaved: vi.fn(), onClose: vi.fn(), onToggle: vi.fn() };

interface HarnessProps {
  readonly visible: boolean;
  readonly seed: SeedSource<Meter>;
  readonly click: boolean;
}

function Harness({ visible, seed, click }: HarnessProps) {
  const tempo = useSetTempo(KIT, { ...player, seed }, callbacks);
  useTempoPreview(tempo, visible, player.previewTempo);
  return (
    <SetTempoSheet
      visible={visible}
      bottomInset={0}
      playhead={PLAYHEAD}
      tempo={tempo}
      transport={TRANSPORT}
      previewClick={{ on: click, onToggle: callbacks.onToggle }}
      onClose={callbacks.onClose}
    />
  );
}

function mount(seed = NO_SEED, click = true): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<Harness visible seed={seed} click={click} />);
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

const all = (tree: ReactTestRenderer, type: string) =>
  tree.root.findAllByType(type as never);

function one(tree: ReactTestRenderer, type: string, label?: string) {
  const found = all(tree, type).find(
    (node) => label === undefined || node.props.label === label,
  );
  if (found === undefined) throw new Error(`no ${type} ${label ?? ''}`);
  return found;
}

function call(node: ReactTestInstance, handler: string, ...args: unknown[]) {
  act(() => {
    (node.props[handler] as (...a: unknown[]) => void)(...args);
  });
}

function typeTempo(tree: ReactTestRenderer, digits: readonly number[]) {
  for (const digit of digits) call(one(tree, 'NumpadKeypad'), 'onDigit', digit);
}

function toStepTwo(tree: ReactTestRenderer) {
  typeTempo(tree, [1, 2, 8]);
  call(one(tree, 'NumpadKeypad'), 'onConfirm');
}

const detail = (tree: ReactTestRenderer) =>
  one(tree, 'Sheet').props.titleDetail as string;

async function save(tree: ReactTestRenderer) {
  await act(async () => {
    (one(tree, 'Button', SET_TEMPO_COPY.save).props.onPress as () => void)();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('step 1', () => {
  it('opens on Type at step 1 with the rules range', () => {
    const tree = mount();
    expect(detail(tree)).toBe(SET_TEMPO_COPY.stepOne);
    expect(one(tree, 'NumpadReadout').props.hint).toBe('40 – 240 BPM');
  });

  it('warns about a typed tempo past the range and clamps it on Next', () => {
    const tree = mount();
    typeTempo(tree, [4, 1, 2]);
    expect(one(tree, 'NumpadReadout').props).toMatchObject({
      hint: 'Above 240 BPM. Saves as 240.',
      hintTone: 'warning',
    });
    call(one(tree, 'NumpadKeypad'), 'onConfirm');
    expect(one(tree, 'Stepper').props.value).toBe('240');
  });

  it('halves a typed tempo', () => {
    const tree = mount();
    typeTempo(tree, [1, 2, 8]);
    call(one(tree, 'PresetButton', '÷2 · 64'), 'onPress');
    expect(one(tree, 'NumpadReadout').props.digits).toBe('64');
  });

  it('counts taps and sets the tempo once the rules have enough', () => {
    const tree = mount();
    call(one(tree, 'SegmentedControl'), 'onSelect', 'tap');
    const tapAt = (timestamp: number) => {
      call(one(tree, 'TapPad'), 'onTap', { nativeEvent: { timestamp } });
    };
    tapAt(0);
    tapAt(TAP_GAP_MS);
    expect(one(tree, 'TapLeds').props).toMatchObject({ landed: 2, total: 3 });
    expect(one(tree, 'Button', SET_TEMPO_COPY.next).props.disabled).toBe(true);
    tapAt(2 * TAP_GAP_MS);
    expect(one(tree, 'NumpadReadout').props.digits).toBe('120');
    call(one(tree, 'Button', SET_TEMPO_COPY.next), 'onPress');
    expect(one(tree, 'Stepper').props.value).toBe('120');
  });

  it('names the analysed tempo it prefills from', () => {
    const tree = mount({ ...NO_SEED, analysedBpm: 132, barOneSeconds: 0.8 });
    expect(detail(tree)).toBe('was 132 from analysis');
    expect(one(tree, 'NumpadReadout').props.digits).toBe('132');
  });
});

describe('step 2', () => {
  it('starts bar 1 at the playhead and previews the draft', () => {
    const tree = mount();
    toStepTwo(tree);
    expect(detail(tree)).toBe(SET_TEMPO_COPY.stepTwo);
    expect(one(tree, 'BeatStrip').props.beatsPerBar).toBe(4);
    expect(player.previewTempo).toHaveBeenLastCalledWith({
      bpm: 128,
      anchor: PLAYHEAD_SEC,
      beatsPerBar: 4,
    });
  });

  it('nudges bar 1, steps the tempo by the rules step and picks a meter', () => {
    const tree = mount();
    toStepTwo(tree);
    call(one(tree, 'PresetButton', '+10 ms'), 'onPress');
    call(one(tree, 'Stepper'), 'onLater');
    call(one(tree, 'SegmentedControl'), 'onSelect', '3');
    expect(one(tree, 'Stepper').props.value).toBe('128.5');
    expect(player.previewTempo).toHaveBeenLastCalledWith({
      bpm: 128.5,
      anchor: 2.31,
      beatsPerBar: 3,
    });
  });

  it('shows and toggles the click through the Preview click chip', () => {
    const tree = mount(NO_SEED, false);
    toStepTwo(tree);
    const chip = one(tree, 'Chip', SET_TEMPO_COPY.previewClick);
    expect(chip.props.active).toBe(false);
    call(chip, 'onPress');
    expect(callbacks.onToggle).toHaveBeenCalledOnce();
  });

  it('goes back to step 1 and drops the preview', () => {
    const tree = mount();
    toStepTwo(tree);
    call(one(tree, 'Button', SET_TEMPO_COPY.back), 'onPress');
    expect(detail(tree)).toBe(SET_TEMPO_COPY.stepOne);
    expect(player.previewTempo).toHaveBeenLastCalledWith(null);
  });

  it('saves the draft, reports it and closes', async () => {
    const tree = mount();
    toStepTwo(tree);
    await save(tree);
    expect(player.setManualTempo).toHaveBeenCalledWith({
      bpm: 128,
      anchor: PLAYHEAD_SEC,
      beatsPerBar: 4,
    });
    expect(callbacks.onSaved).toHaveBeenCalledWith(
      'Tempo set: 128 BPM, bar 1 at 0:02.3.',
    );
    expect(callbacks.onClose).toHaveBeenCalledOnce();
    expect(callbacks.onToggle).not.toHaveBeenCalled();
  });

  it('stays open and says so when the tempo is not stored', async () => {
    player.setManualTempo.mockResolvedValueOnce(false);
    const tree = mount();
    toStepTwo(tree);
    await save(tree);
    expect(one(tree, 'Snackbar').props.message).toBe(SET_TEMPO_COPY.saveFailed);
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(detail(tree)).toBe(SET_TEMPO_COPY.stepTwo);
  });
});
