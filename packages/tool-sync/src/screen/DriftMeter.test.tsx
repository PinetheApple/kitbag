import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DRIFT_STATE, type DriftView } from '../logic/driftMeter.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return { View: host, Text: host, StyleSheet: { create: <T,>(s: T) => s } };
});

vi.mock('react-native-reanimated', () => ({
  useSharedValue: <T,>(value: T) => ({ value }),
}));

const strips = vi.hoisted(() => [] as Props[]);

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    useTextScaled: () => false,
    Badge: (props: Props) => h('b', null, props.label as string),
    DrawnFigures: (props: Props) => h('i', null, props.text as string),
    Button: (props: Props) => h('button', null, props.label as string),
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
};

function drawn(view: DriftView) {
  strips.length = 0;
  return renderToStaticMarkup(
    createElement(DriftMeterCard, { view, onRetap: vi.fn() }),
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
});
