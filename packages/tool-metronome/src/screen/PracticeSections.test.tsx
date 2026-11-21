// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  SHEET_TOUCH_ROOM,
  switchHitBox,
  type NeighbourGaps,
} from '@kitbag/core-design';
import { act, createElement, type ComponentType } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

type Style = Readonly<Record<string, unknown>>;

const display = vi.hoisted(() => ({ scaled: false }));
const store = vi.hoisted(() => ({
  beatsPerBar: 4,
  polyEnabled: false,
  polyBeats: 3,
  polyAgainst: 4,
  setPoly: () => undefined,
  stepPolyAgainst: () => undefined,
}));

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { absoluteFill: {} },
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: (build: (theme: unknown) => unknown) => () =>
    build({ color: {} }),
  textStyle: () => ({}),
  useTextScaled: () => display.scaled,
  Icon: 'Icon',
  StepControl: 'StepControl',
  SegmentedControl: 'SegmentedControl',
  Chip: 'Chip',
  SheetHint: 'SheetHint',
  Switch: 'Switch',
}));

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useMetronome: (select: (state: typeof store) => unknown) => select(store),
}));
vi.mock('./useRampEditor.ts', async () => {
  const { KB_RAMP_UNIT } = await import('@kitbag/core-native');
  return {
    useRampEditor: () => ({
      ramp: {
        startBpm: 100,
        targetBpm: 120,
        stepBpm: 5,
        interval: 4,
        unit: KB_RAMP_UNIT.KB_RAMP_BARS,
        loop: false,
        enabled: false,
      },
    }),
  };
});
vi.mock('./useBarMuteEditor.ts', () => ({
  useBarMuteEditor: () => ({
    barMute: { enabled: false, playBars: 4, muteBars: 4 },
    preview: [],
  }),
}));
vi.mock('./PolyStrip.tsx', () => ({ PolyStrip: () => null }));

const { PracticeRamp } = await import('./PracticeRamp.tsx');
const { PracticeMute, PracticePoly } = await import('./PracticeSections.tsx');

type Section = ComponentType<{ onType: () => void }>;

const SECTIONS: readonly (readonly [string, Section])[] = [
  ['Tempo ramp', PracticeRamp],
  ['Mute bars', PracticeMute],
  ['Polyrhythm', PracticePoly],
];

const isHost = (name: string) => (node: ReactTestInstance) =>
  (node.type as unknown) === name;

const flat = (style: unknown): Style =>
  Object.assign({}, ...[style].flat(Infinity)) as Style;

function render(Section: Section, scaled: boolean): ReactTestInstance {
  display.scaled = scaled;
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(createElement(Section, { onType: vi.fn() }));
  });
  display.scaled = false;
  if (renderer === undefined) throw new Error('nothing rendered');
  return renderer.root;
}

describe.each(SECTIONS)('the %s section', (label, Section) => {
  it('gives its switch the whole sheet edge room to its right', () => {
    const toggle = render(Section, false).find(
      (node) =>
        isHost('Switch')(node) && node.props.accessibilityLabel === label,
    );
    const box = switchHitBox(
      toggle.props.neighbourGapDp as NeighbourGaps,
      toggle.props.edgeRoomDp as NeighbourGaps,
    );
    expect(box.paddingRight).toBe(SHEET_TOUCH_ROOM);
  });

  it('keeps each row label on the line of its stepper at scaled text', () => {
    const steppers = render(Section, true).findAll(isHost('StepControl'));
    expect(steppers.length).toBeGreaterThan(0);
    for (const stepper of steppers) {
      const unit = stepper.parent;
      const style = flat(unit?.props.style);
      expect(style.flexDirection).toBe('row');
      expect(style.flexWrap).toBeUndefined();
      expect(unit?.findAll(isHost('Text'))).toHaveLength(1);
    }
  });
});

it('gives the ramp interval unit its own line at scaled text', () => {
  const unit = render(PracticeRamp, true).find(
    (node) => node.props.accessibilityLabel === 'Ramp interval unit',
  );
  expect(flat(unit.parent?.props.style).width).toBe('100%');
});
