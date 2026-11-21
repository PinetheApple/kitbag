import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  reachEdges,
  size,
  type NeighbourGaps,
} from '@kitbag/core-design';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const SHEET_ROOM = vi.hoisted(() => 12);
const switches = vi.hoisted(() => [] as Props[]);
const store = vi.hoisted(() => ({
  beatsPerBar: 4,
  polyEnabled: false,
  polyBeats: 3,
  polyAgainst: 4,
  setPoly: () => undefined,
  stepPolyAgainst: () => undefined,
}));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return { View: host, Text: host };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () => ({}),
  Icon: () => null,
  StepControl: () => null,
  SegmentedControl: () => null,
  Chip: () => null,
  SheetHint: () => null,
  SHEET_TOUCH_ROOM: SHEET_ROOM,
  Switch: (props: Props) => {
    switches.push(props);
    return null;
  },
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

const SECTIONS = [
  ['Tempo ramp', PracticeRamp],
  ['Mute bars', PracticeMute],
  ['Polyrhythm', PracticePoly],
] as const;

describe.each(SECTIONS)('the %s switch', (label, Section) => {
  it('takes the whole sheet edge room to its right as touch area', () => {
    switches.length = 0;
    renderToStaticMarkup(createElement(Section, { onType: vi.fn() }));
    const props = switches.find((s) => s.accessibilityLabel === label);
    const box = hitBoxStyle(
      reachEdges(
        hitExtension(
          size.switchWidth,
          size.switchHeight,
          neighbourGaps(props?.neighbourGapDp as NeighbourGaps),
        ),
        props?.edgeRoomDp as NeighbourGaps,
      ),
    );
    expect(box.paddingRight).toBe(SHEET_ROOM);
  });
});
