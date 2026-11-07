import { metronome } from '@kitbag/core-design';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PRACTICE_OFF } from '../logic/fixtures.test-helper.ts';
import type { PracticeSettings, StatusRow } from '../logic/statusRows.ts';
import type { StatusFrame } from './StatusStack.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ fontScale: 1 }));
const variants = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) => h('div', null, props.children);
  return {
    View: box,
    Text: box,
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
  };
});

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  return {
    default: { View: (props: Props) => h('div', null, props.children) },
    useAnimatedStyle: () => ({}),
    useDerivedValue: () => ({ value: '' }),
  };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Icon: () => null,
  IconGlyph: () => null,
  LiveSlot: () => null,
  LiveText: () => null,
  useReduceMotionValue: () => ({ value: false }),
  useTheme: () => ({ color: new Proxy({}, { get: () => '' }) }),
}));

vi.mock('./statusStyles.ts', () => ({
  countInInk: () => '',
  useStatusStyles: () => new Proxy({}, { get: () => ({}) }),
}));

vi.mock('./MuteStatus.tsx', () => ({ MuteStatus: () => null }));

vi.mock('./StatusVariant.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    StatusVariant: (props: Props) => {
      variants.push(props);
      return h('div', null, props.children);
    },
  };
});

const { StatusStack } = await import('./StatusStack.tsx');

const SETTINGS: PracticeSettings = {
  ...PRACTICE_OFF,
  ramp: { ...PRACTICE_OFF.ramp, enabled: true },
};

const FRAME = new Proxy({}, { get: () => ({ value: 0 }) }) as StatusFrame;

function styleAt(fontScale: number, shown: StatusRow): unknown {
  display.fontScale = fontScale;
  variants.length = 0;
  renderToStaticMarkup(
    createElement(StatusStack, {
      frame: FRAME,
      settings: SETTINGS,
      running: true,
      stackRows: 2,
    }),
  );
  display.fontScale = 1;
  return variants.find((props) => props.shown === shown)?.style;
}

const RESERVE = { paddingBottom: metronome.statusProgress };

describe('status rows with a progress bar', () => {
  it('reserve no strip at the default text size', () => {
    expect(styleAt(1, 'ramp')).not.toContainEqual(RESERVE);
    expect(styleAt(1, 'reached')).not.toContainEqual(RESERVE);
  });

  it('keep grown text above the bar', () => {
    expect(styleAt(2, 'ramp')).toContainEqual(RESERVE);
    expect(styleAt(2, 'reached')).toContainEqual(RESERVE);
  });
});
