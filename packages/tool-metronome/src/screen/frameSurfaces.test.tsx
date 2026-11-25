import { KB_ACCENT } from '@kitbag/core-native';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PRACTICE_OFF } from '../logic/fixtures.test-helper.ts';
import type { PracticeSettings } from '../logic/statusRows.ts';
import type { BeatDotsFrame } from './BeatDots.tsx';
import type { StatusFrame } from './StatusStack.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Style = Readonly<Record<string, unknown>>;

const styles = vi.hoisted(() => [] as Style[]);
const fills = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) => h('div', null, props.children);
  return {
    View: box,
    Text: box,
    Pressable: box,
    StyleSheet: { absoluteFill: {} },
    useWindowDimensions: () => ({ fontScale: 1 }),
  };
});

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  return {
    default: { View: (props: Props) => h('div', null, props.children) },
    useAnimatedStyle: (build: () => Style) => {
      const style = build();
      styles.push(style);
      return style;
    },
    useDerivedValue: (build: () => unknown) => ({
      get value() {
        return build();
      },
    }),
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (next: unknown) => void,
    ) => {
      react(prepare());
    },
    useSharedValue: (value: unknown) => ({ value }),
  };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () => new Proxy({}, { get: () => ({}) }),
  FillBar: (props: Props) => {
    fills.push(props);
    return null;
  },
  hitBoxStyle: () => ({}),
  hitExtension: () => ({}),
  Icon: () => null,
  IconGlyph: () => null,
  LiveSlot: () => null,
  LiveText: () => null,
  mixHex: (from: string) => from,
  TRANSPARENT: 'clear',
  useReduceMotionValue: () => ({ value: false }),
  useTheme: () => ({
    color: new Proxy({}, { get: (_target, key) => String(key) }),
  }),
}));

vi.mock('./statusStyles.ts', () => ({
  countInInk: () => '',
  useStatusStyles: () => new Proxy({}, { get: () => ({}) }),
}));
vi.mock('./MuteStatus.tsx', () => ({ MuteStatus: () => null }));
vi.mock('./StatusVariant.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    StatusVariant: (props: Props) => h('div', null, props.children),
  };
});
vi.mock('./PolyDots.tsx', () => ({ PolyDots: () => null }));
vi.mock('./CountInSquares.tsx', () => ({ CountInSquares: () => null }));

const { BarSweep } = await import('./BarSweep.tsx');
const { BeatDots } = await import('./BeatDots.tsx');
const { StatusStack } = await import('./StatusStack.tsx');

const COLOUR_KEYS = new Set(['backgroundColor', 'borderColor', 'color']);
const SUBDIVISION = 2;
const ACCENTS = [
  KB_ACCENT.KB_ACCENT_ACCENTED,
  KB_ACCENT.KB_ACCENT_NORMAL,
  KB_ACCENT.KB_ACCENT_NORMAL,
  KB_ACCENT.KB_ACCENT_NORMAL,
];
const RAMP_ON: PracticeSettings = {
  ...PRACTICE_OFF,
  ramp: { ...PRACTICE_OFF.ramp, enabled: true },
};

interface Moment {
  readonly barPhase: number;
  readonly currentBeat: number;
  readonly rampStepProgress: number;
}

const ON_BEAT_ONE: Moment = {
  barPhase: 0.05,
  currentBeat: 0,
  rampStepProgress: 0.2,
};
const ON_BEAT_TWO: Moment = {
  barPhase: 0.4,
  currentBeat: 1,
  rampStepProgress: 0.7,
};

function frameAt(moment: Moment): BeatDotsFrame & StatusFrame {
  const values: Record<string, number> = { ...moment };
  return new Proxy({} as BeatDotsFrame & StatusFrame, {
    get: (_target, key) => ({ value: values[String(key)] ?? 0 }),
  });
}

function stylesAt(moment: Moment): Style[] {
  styles.length = 0;
  fills.length = 0;
  const frame = frameAt(moment);
  renderToStaticMarkup(
    createElement('div', null, [
      createElement(BarSweep, {
        key: 'sweep',
        barPhase: frame.barPhase,
        gap: 0,
      }),
      createElement(BeatDots, {
        key: 'dots',
        beatCount: ACCENTS.length,
        subdivision: SUBDIVISION,
        polyBeats: null,
        polyAgainst: 0,
        accents: ACCENTS,
        width: 360,
        density: 'roomy',
        frame,
        onCycle: vi.fn(),
      }),
      createElement(StatusStack, {
        key: 'status',
        frame,
        settings: RAMP_ON,
        running: true,
        stackRows: 2,
      }),
    ]),
  );
  return [...styles];
}

function keysThatMove(before: readonly Style[], after: readonly Style[]) {
  const moved = new Set<string>();
  before.forEach((style, index) => {
    const next = after[index] ?? {};
    for (const key of new Set([...Object.keys(style), ...Object.keys(next)]))
      if (JSON.stringify(style[key]) !== JSON.stringify(next[key]))
        moved.add(key);
  });
  return [...moved];
}

function fillProgress(testID: string): number {
  const fill = fills.find((props) => props.testID === testID);
  if (fill === undefined) throw new Error(`no fill bar ${testID}`);
  return (fill.progress as { value: number }).value;
}

describe('default-mode surfaces the playing frame drives', () => {
  it('change only colours on their Views, which Android does not report to accessibility', () => {
    const before = stylesAt(ON_BEAT_ONE);
    const after = stylesAt(ON_BEAT_TWO);
    expect(after).toHaveLength(before.length);
    const moved = keysThatMove(before, after);
    expect(moved).toEqual(
      expect.arrayContaining(['backgroundColor', 'borderColor']),
    );
    expect(moved.filter((key) => !COLOUR_KEYS.has(key))).toEqual([]);
  });

  it.each([ON_BEAT_ONE, ON_BEAT_TWO])(
    'draw the bar sweep and the ramp step on svg fill bars at %o',
    (moment) => {
      stylesAt(moment);
      expect(fillProgress('bar-sweep')).toBe(moment.barPhase);
      expect(fillProgress('ramp-step-progress')).toBe(moment.rampStepProgress);
    },
  );
});
