import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return {
    View: host,
    Text: (props: Props) => h('span', null, props.children),
    StyleSheet: { create: <T,>(s: T) => s },
  };
});

const seen = vi.hoisted(() => ({
  sheets: [] as Props[],
  steppers: [] as Props[],
  segments: [] as Props[],
  buttons: [] as Props[],
  readouts: [] as Props[],
}));

vi.mock('./Stepper.tsx', () => ({
  Stepper: (props: Props) => {
    seen.steppers.push(props);
    return null;
  },
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    Sheet: (props: Props) => {
      seen.sheets.push(props);
      return h('section', null, props.titleAction as ReactNode, props.children);
    },
    SectionHeader: (props: Props) => h('h6', null, props.label as string),
    DrawnFigures: (props: Props) => h('i', null, props.text as string),
    NumpadReadout: (props: Props) => {
      seen.readouts.push(props);
      return h('p', null, props.hint as string);
    },
    SegmentedControl: (props: Props) => {
      seen.segments.push(props);
      return null;
    },
    Button: (props: Props) => {
      seen.buttons.push(props);
      return null;
    },
  };
});

const BPM = 171;

const playAlong = vi.hoisted(() => ({
  lock: undefined as Record<string, unknown> | undefined,
  pattern: { denominator: 4 },
  phaseStepMs: 10,
  latencyOffsetMs: 180,
  nudgePhase: vi.fn(),
  setPhaseStep: vi.fn(),
  shiftDownbeat: vi.fn(),
  resetPhase: vi.fn(),
}));

vi.mock('./playAlongHooks.ts', () => ({
  usePlayAlong: <T,>(selector: (state: typeof playAlong) => T) =>
    selector(playAlong),
  useFollowedSession: () => ({ speed: 1 }),
}));

const { PhaseSheet } = await import('./PhaseSheet.tsx');
const { DOWNBEAT_UNAVAILABLE } = await import('./PhaseSheet.tsx');

const lock = {
  sessionId: 'spotify',
  bpm: BPM,
  phaseOffsetMs: 10,
  downbeatShift: 0,
  downbeatShiftAvailable: true,
};

function drawn(visible = true) {
  seen.sheets.length = 0;
  seen.steppers.length = 0;
  seen.segments.length = 0;
  seen.buttons.length = 0;
  seen.readouts.length = 0;
  return renderToStaticMarkup(
    createElement(PhaseSheet, { visible, bottomInset: 0, onDismiss: vi.fn() }),
  );
}

const nudgeStepper = () => seen.steppers[0];
const downbeatStepper = () => seen.steppers[1];

beforeEach(() => {
  vi.clearAllMocks();
  playAlong.lock = lock;
  playAlong.phaseStepMs = 10;
});

describe('PhaseSheet', () => {
  it('reads the nudge and its share of a beat at the song tempo', () => {
    const markup = drawn();
    expect(seen.readouts[0]).toMatchObject({ digits: '+10 ms' });
    expect(markup).toContain('2.9% of a beat at 171 BPM');
  });

  it('shows the half-beat range at the song tempo', () => {
    const markup = drawn();
    expect(markup).toContain('−½ beat · −175 ms');
    expect(markup).toContain('+175 ms · +½ beat');
  });

  it('nudges with the sheet stepper at the chosen step', () => {
    drawn();
    expect(nudgeStepper()).toMatchObject({
      value: '+10 ms',
      onStep: playAlong.nudgePhase,
      tone: 'on',
    });
    expect(seen.segments[0]).toMatchObject({ selected: '10' });
  });

  it('sets the step size from the segmented control', () => {
    drawn();
    (seen.segments[0]?.onSelect as (value: string) => void)('50');
    expect(playAlong.setPhaseStep).toHaveBeenCalledWith(50);
  });

  it('shifts the downbeat with the beat stepper', () => {
    playAlong.lock = { ...lock, downbeatShift: 2 };
    drawn();
    expect(downbeatStepper()).toMatchObject({
      value: 'Beat 3',
      disabled: false,
      onStep: playAlong.shiftDownbeat,
    });
  });

  it('disables and announces the downbeat shift when the grid has none', () => {
    playAlong.lock = { ...lock, downbeatShiftAvailable: false };
    drawn();
    expect(downbeatStepper()).toMatchObject({
      disabled: true,
      accessibilityLabel: DOWNBEAT_UNAVAILABLE,
    });
  });

  it('adds the route latency and the song nudge into one total', () => {
    const markup = drawn();
    expect(markup).toContain('<i>+190 ms total</i>');
    expect(markup).toContain('· 180 route + 10 song');
  });

  it('resets phase and downbeat from the title action', () => {
    drawn();
    expect(seen.buttons[0]).toMatchObject({
      label: 'Reset',
      onPress: playAlong.resetPhase,
    });
  });

  it('stays closed with no lock', () => {
    playAlong.lock = undefined;
    drawn();
    expect(seen.sheets[0]).toMatchObject({ visible: false });
    expect(seen.steppers).toHaveLength(0);
  });
});
