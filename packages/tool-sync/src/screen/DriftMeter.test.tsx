import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DRIFT_STATE, type DriftView } from '../logic/driftMeter.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return {
    View: host,
    Text: host,
    Pressable: host,
    StyleSheet: { create: <T,>(s: T) => s },
  };
});

vi.mock('react-native-reanimated', () => ({
  useSharedValue: <T,>(value: T) => ({ value }),
}));

const strips = vi.hoisted(() => [] as Props[]);
const cards = vi.hoisted(() => [] as Props[]);
const buttons = vi.hoisted(() => [] as Props[]);
const steppers = vi.hoisted(() => [] as Props[]);

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    useTextScaled: () => false,
    Badge: (props: Props) => h('b', null, props.label as string),
    SectionHeader: (props: Props) => h('h6', null, props.label as string),
    Stepper: (props: Props) => {
      steppers.push(props);
      return null;
    },
    DrawnFigures: (props: Props) => h('i', null, props.text as string),
    Button: (props: Props) => {
      buttons.push(props);
      return h('button', null, props.label as string);
    },
    Card: (props: Props) => {
      cards.push(props);
      return h('section', null, props.children);
    },
    TunerStrip: (props: Props) => {
      strips.push(props);
      return null;
    },
  };
});

const { DRIFT_STRIP_STOPS } = await import('@kitbag/core-design');
const { DriftMeterCard } = await import('./DriftMeter.tsx');

const locked: DriftView = {
  state: DRIFT_STATE.locked,
  badge: { label: 'LOCKED', tone: 'success' },
  lead: 'Locked · ',
  figures: '1:12',
  tail: ' ago',
  reading: '+2 ms',
  needle: 0.04,
  muted: false,
  controls: true,
  retapEnabled: true,
};

const drift: DriftView = {
  ...locked,
  state: DRIFT_STATE.drift,
  badge: { label: 'DRIFT', tone: 'warning' },
  lead: 'Off by more than 10 ms',
  figures: null,
  tail: '',
  reading: '+38 ms',
  controls: false,
  retapEnabled: false,
};

const paused: DriftView = {
  ...locked,
  state: DRIFT_STATE.paused,
  lead: 'Paused · resumes on the beat',
  figures: null,
  tail: '',
  reading: '0 ms',
  muted: true,
  retapEnabled: false,
};

const phase = { reading: '+10 ms', onNudge: vi.fn(), onOpen: vi.fn() };

function drawn(view: DriftView) {
  strips.length = 0;
  cards.length = 0;
  buttons.length = 0;
  steppers.length = 0;
  return renderToStaticMarkup(
    createElement(DriftMeterCard, { view, phase, onRetap: vi.fn() }),
  );
}

beforeEach(() => {
  strips.length = 0;
});

describe('DriftMeterCard', () => {
  it('names the lock, how long ago, and the drift, with Re-tap under it', () => {
    const markup = drawn(locked);
    expect(markup).toContain('LOCKED');
    expect(markup).toContain('<i>1:12</i>');
    expect(markup).toContain('<i>+2 ms</i>');
    expect(markup).toContain('Re-tap');
  });

  it('draws the strip on the drift scale with a plain needle when quiet', () => {
    drawn(locked);
    expect(strips[0]).toMatchObject({
      stops: DRIFT_STRIP_STOPS,
      needleColor: 'text',
    });
  });

  it('ambers the needle and drops the controls on drift', () => {
    const markup = drawn(drift);
    expect(markup).toContain('DRIFT');
    expect(markup).not.toContain('Re-tap');
    expect(strips[0]).toMatchObject({ needleColor: 'amber' });
  });

  it('draws a warning card border on drift and a plain one when quiet', () => {
    drawn(drift);
    expect(cards[0]).toMatchObject({ borderTone: 'warning' });
    drawn(locked);
    expect(cards[0]?.borderTone).toBeUndefined();
  });

  it('shows Re-tap disabled while paused, and enabled while locked', () => {
    drawn(paused);
    expect(buttons[0]).toMatchObject({ label: 'Re-tap', disabled: true });
    drawn(locked);
    expect(buttons[0]).toMatchObject({ disabled: false });
  });

  it('puts the phase stepper under the strip, its value opening the sheet', () => {
    const markup = drawn(locked);
    expect(markup).toContain('<h6>Phase</h6>');
    expect(steppers[0]).toMatchObject({
      value: '+10 ms',
      onValuePress: phase.onOpen,
    });
    (steppers[0]?.onEarlier as () => void)();
    (steppers[0]?.onLater as () => void)();
    expect(phase.onNudge.mock.calls).toEqual([[-1], [1]]);
  });

  it('keeps the phase stepper while paused', () => {
    drawn(paused);
    expect(steppers).toHaveLength(1);
  });

  it('drops the phase stepper on drift', () => {
    const markup = drawn(drift);
    expect(markup).not.toContain('Phase');
    expect(steppers).toHaveLength(0);
  });
});
