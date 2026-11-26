import { KB_ACCENT, KB_RAMP_STATE } from '@kitbag/core-native';
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
const countBeats = vi.hoisted(() => [] as number[]);
const nativeTexts = vi.hoisted(() => [] as string[]);
const drawnTexts = vi.hoisted(() => [] as string[]);

function recordText(props: Props): void {
  const children = [props.children].flat();
  nativeTexts.push(
    children.filter((child) => typeof child === 'string').join(''),
  );
}

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) => h('div', null, props.children);
  const text = (props: Props) => {
    recordText(props);
    return box(props);
  };
  return {
    View: box,
    Text: text,
    Pressable: box,
    StyleSheet: { absoluteFill: {} },
    useWindowDimensions: () => ({ fontScale: 1 }),
  };
});

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) => h('div', null, props.children);
  const text = (props: Props) => {
    recordText(props);
    return box(props);
  };
  return {
    default: { View: box, Text: text },
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

vi.mock('@kitbag/core-design', async (original) => {
  return {
    ...(await original<Record<string, unknown>>()),
    CountSquare: (props: Props) => {
      countBeats.push((props.currentBeat as { value: number }).value);
      return null;
    },
    createThemedStyles: () => () => new Proxy({}, { get: () => ({}) }),
    DrawnLiveSlot: (props: Props) => {
      drawnTexts.push((props.text as { value: string }).value);
      return null;
    },
    FillBar: (props: Props) => {
      fills.push(props);
      return null;
    },
    hitBoxStyle: () => ({}),
    hitExtension: () => ({}),
    Icon: () => null,
    IconGlyph: () => null,
    mixHex: (from: string) => from,
    TRANSPARENT: 'clear',
    useReduceMotionValue: () => ({ value: false }),
    useTheme: () => ({
      color: new Proxy({}, { get: (_target, key) => String(key) }),
    }),
  };
});

vi.mock('./statusStyles.ts', () => ({
  countInInk: () => '',
  useStatusStyles: () => new Proxy({}, { get: () => ({}) }),
}));

const { BarSweep } = await import('./BarSweep.tsx');
const { BeatDots } = await import('./BeatDots.tsx');
const { StatusStack } = await import('./StatusStack.tsx');

const VIEW_COLOUR_KEYS = new Set(['backgroundColor', 'borderColor']);
const SUBDIVISION = 2;
const POLY_BEATS = 3;
const POLY_AGAINST_BEATS = 3;
const ACCENTS = [
  KB_ACCENT.KB_ACCENT_ACCENTED,
  KB_ACCENT.KB_ACCENT_NORMAL,
  KB_ACCENT.KB_ACCENT_MUTED,
  KB_ACCENT.KB_ACCENT_NORMAL,
];
const RAMP_ON: PracticeSettings = {
  ...PRACTICE_OFF,
  ramp: { ...PRACTICE_OFF.ramp, enabled: true },
};
const BAR_MUTE_ON: PracticeSettings = {
  ...PRACTICE_OFF,
  barMute: { ...PRACTICE_OFF.barMute, enabled: true },
};
const COUNT_IN_BARS = 2;

type FrameKey = keyof (BeatDotsFrame & StatusFrame);
type Moment = Readonly<Partial<Record<FrameKey, number>>>;

const STOPPED: Readonly<Record<FrameKey, number>> = {
  barPhase: 0,
  currentBeat: 0,
  currentPolyBeat: 0,
  polyDownbeatPhase: 0,
  barMuted: 0,
  countingIn: 0,
  countInBar: 0,
  countInBarsTotal: 0,
  barMutePosition: 0,
  rampState: 0,
  rampNextBpm: 0,
  rampRemaining: 0,
  rampStepProgress: 0,
};

interface Mode {
  readonly name: string;
  readonly settings: PracticeSettings;
  readonly polyBeats: number | null;
  readonly before: Moment;
  readonly after: Moment;
}

const ON_BEAT_ONE = {
  barPhase: 0.05,
  currentBeat: 0,
  rampStepProgress: 0.2,
};
const ON_BEAT_TWO = {
  barPhase: 0.4,
  currentBeat: 1,
  rampStepProgress: 0.7,
};

const DEFAULT_MODE: Mode = {
  name: 'default',
  settings: RAMP_ON,
  polyBeats: null,
  before: ON_BEAT_ONE,
  after: ON_BEAT_TWO,
};

const POLY_MODE: Mode = {
  name: 'polyrhythm, across a cycle that shifts against the bar',
  settings: PRACTICE_OFF,
  polyBeats: POLY_BEATS,
  before: { ...ON_BEAT_ONE, polyDownbeatPhase: 0, currentPolyBeat: 0 },
  after: {
    ...ON_BEAT_TWO,
    polyDownbeatPhase: 1 / POLY_AGAINST_BEATS,
    currentPolyBeat: 1,
  },
};

const BAR_MUTE_MODE: Mode = {
  name: 'bar mute, from a played bar into a muted one',
  settings: BAR_MUTE_ON,
  polyBeats: null,
  before: { ...ON_BEAT_ONE, barMutePosition: 1, barMuted: 0 },
  after: { ...ON_BEAT_TWO, barMutePosition: 2, barMuted: 1 },
};

const COUNT_IN_MODE: Mode = {
  name: 'count-in, from its first bar into its second',
  settings: PRACTICE_OFF,
  polyBeats: null,
  before: {
    ...ON_BEAT_ONE,
    countingIn: 1,
    countInBar: 0,
    countInBarsTotal: COUNT_IN_BARS,
  },
  after: {
    ...ON_BEAT_TWO,
    countingIn: 1,
    countInBar: 1,
    countInBarsTotal: COUNT_IN_BARS,
  },
};

const RAMP_MODE: Mode = {
  name: 'ramp, across a step',
  settings: RAMP_ON,
  polyBeats: null,
  before: {
    ...ON_BEAT_ONE,
    rampState: KB_RAMP_STATE.KB_RAMP_STATE_STEPPING,
    rampNextBpm: 104,
    rampRemaining: 2,
  },
  after: {
    ...ON_BEAT_TWO,
    rampState: KB_RAMP_STATE.KB_RAMP_STATE_STEPPING,
    rampNextBpm: 108,
    rampRemaining: 1,
  },
};

const MODES: readonly Mode[] = [
  DEFAULT_MODE,
  POLY_MODE,
  BAR_MUTE_MODE,
  COUNT_IN_MODE,
  RAMP_MODE,
];

function frameAt(moment: Moment): BeatDotsFrame & StatusFrame {
  const values: Readonly<Record<string, number>> = { ...STOPPED, ...moment };
  return new Proxy({} as BeatDotsFrame & StatusFrame, {
    get: (_target, key) => {
      const value = values[String(key)];
      if (value === undefined) throw new Error(`no frame value ${String(key)}`);
      return { value };
    },
  });
}

interface Drawn {
  readonly styles: Style[];
  readonly nativeTexts: string[];
  readonly drawn: string[];
}

function drawAt(mode: Mode, moment: Moment): Drawn {
  styles.length = 0;
  fills.length = 0;
  countBeats.length = 0;
  nativeTexts.length = 0;
  drawnTexts.length = 0;
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
        polyBeats: mode.polyBeats,
        polyAgainst: POLY_AGAINST_BEATS,
        accents: ACCENTS,
        width: 360,
        density: 'roomy',
        frame,
        onCycle: vi.fn(),
      }),
      createElement(StatusStack, {
        key: 'status',
        frame,
        settings: mode.settings,
        running: true,
        stackRows: 2,
      }),
    ]),
  );
  return {
    styles: [...styles],
    nativeTexts: [...nativeTexts],
    drawn: [...drawnTexts],
  };
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

describe.each(MODES)('the playing frame, $name,', (mode) => {
  it('changes only colours on its Views, which Android does not report to accessibility', () => {
    const before = drawAt(mode, mode.before);
    const after = drawAt(mode, mode.after);
    expect(after.styles).toHaveLength(before.styles.length);
    const moved = keysThatMove(before.styles, after.styles);
    expect(moved).toEqual(
      expect.arrayContaining(['backgroundColor', 'borderColor']),
    );
    expect(moved.filter((key) => !VIEW_COLOUR_KEYS.has(key))).toEqual([]);
  });

  it('holds every native text field still', () => {
    const before = drawAt(mode, mode.before);
    const after = drawAt(mode, mode.after);
    expect(before.nativeTexts).not.toEqual([]);
    expect(after.nativeTexts).toEqual(before.nativeTexts);
  });
});

describe('status text the frame changes', () => {
  it.each([
    {
      mode: BAR_MUTE_MODE,
      before: ['Playing', '2 of 4'],
      after: ['Muted bar', '3 of 4'],
    },
    { mode: COUNT_IN_MODE, before: ['bar 1 of 2'], after: ['bar 2 of 2'] },
    {
      mode: RAMP_MODE,
      before: ['→ 104', 'in 2 bars'],
      after: ['→ 108', 'in 1 bar'],
    },
  ])('is drawn in $mode.name', ({ mode, before, after }) => {
    expect(drawAt(mode, mode.before).drawn).toEqual(
      expect.arrayContaining(before),
    );
    expect(drawAt(mode, mode.after).drawn).toEqual(
      expect.arrayContaining(after),
    );
  });
});

describe('default-mode surfaces the playing frame drives', () => {
  it.each([ON_BEAT_ONE, ON_BEAT_TWO])(
    'draw the bar sweep and the ramp step on svg fill bars at %o',
    (moment) => {
      drawAt(DEFAULT_MODE, moment);
      expect(fillProgress('bar-sweep')).toBe(moment.barPhase);
      expect(fillProgress('ramp-step-progress')).toBe(moment.rampStepProgress);
    },
  );

  it('hold the hidden count-in digits still outside a count-in', () => {
    drawAt(DEFAULT_MODE, ON_BEAT_ONE);
    const before = [...countBeats];
    drawAt(DEFAULT_MODE, ON_BEAT_TWO);
    expect(before.length).toBeGreaterThan(0);
    expect(countBeats).toEqual(before);
  });
});
