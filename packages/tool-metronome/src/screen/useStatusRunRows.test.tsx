// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  KB_COUNT_IN_OFF,
  KB_POLY_AGAINST_BAR,
  KB_RAMP_UNIT,
} from '@kitbag/core-native';
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { PracticeSettings } from '../logic/statusRows.ts';

type React = (now: boolean, before: boolean | null) => void;

const worklet = vi.hoisted(() => ({
  react: null as React | null,
  prepare: null as (() => boolean) | null,
}));

vi.mock('react-native-reanimated', () => ({
  useAnimatedReaction: (prepare: () => boolean, react: React) => {
    worklet.prepare = prepare;
    worklet.react = react;
  },
}));

vi.mock('react-native-worklets', () => ({
  scheduleOnRN: (run: (arg: unknown) => void, arg: unknown) => {
    run(arg);
  },
}));

const { useStatusRunRows } = await import('./useStatusRunRows.ts');

const OFF: PracticeSettings = {
  ramp: {
    enabled: false,
    startBpm: 100,
    targetBpm: 140,
    stepBpm: 4,
    interval: 4,
    unit: KB_RAMP_UNIT.KB_RAMP_BARS,
    loop: false,
  },
  barMute: { enabled: false, playBars: 2, muteBars: 2 },
  countIn: { bars: KB_COUNT_IN_OFF, distinct: true, sound: 1 },
  polyEnabled: false,
  polyBeats: 3,
  polyAgainst: KB_POLY_AGAINST_BAR,
  beatsPerBar: 4,
};
const RAMP_AFTER_COUNT_IN: PracticeSettings = {
  ...OFF,
  ramp: { ...OFF.ramp, enabled: true },
  countIn: { ...OFF.countIn, bars: 2 },
};

const seen = { rows: -1 };
function Probe(props: {
  readonly running: boolean;
  readonly settings: PracticeSettings;
}) {
  seen.rows = useStatusRunRows(
    { value: 0 } as never,
    props.running,
    props.settings,
  );
  return null;
}

function mount(running: boolean, settings: PracticeSettings) {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const mounted: { screen?: ReactTestRenderer } = {};
  act(() => {
    mounted.screen = create(createElement(Probe, { running, settings }));
  });
  const update = (nextRunning: boolean, next: PracticeSettings) => {
    act(() => {
      mounted.screen?.update(
        createElement(Probe, { running: nextRunning, settings: next }),
      );
    });
  };
  return update;
}

function engineReads(now: boolean, before: boolean | null) {
  act(() => {
    worklet.react?.(now, before);
  });
}

describe('useStatusRunRows', () => {
  it('holds the count-in rows from Start, before the engine reads arrive', () => {
    const update = mount(false, RAMP_AFTER_COUNT_IN);
    update(true, RAMP_AFTER_COUNT_IN);
    expect(seen.rows).toBe(2);
  });

  it('drops to the played rows when the count-in ends', () => {
    const update = mount(false, RAMP_AFTER_COUNT_IN);
    update(true, RAMP_AFTER_COUNT_IN);
    engineReads(true, false);
    expect(seen.rows).toBe(2);
    engineReads(false, true);
    expect(seen.rows).toBe(1);
  });

  it('takes no action on the first read of a mount', () => {
    const update = mount(false, RAMP_AFTER_COUNT_IN);
    update(true, RAMP_AFTER_COUNT_IN);
    engineReads(false, null);
    expect(seen.rows).toBe(2);
  });

  it('holds the count-in rows again on the next Start after Stop reads as an end', () => {
    const update = mount(false, RAMP_AFTER_COUNT_IN);
    update(true, RAMP_AFTER_COUNT_IN);
    engineReads(true, false);
    update(false, RAMP_AFTER_COUNT_IN);
    engineReads(false, true);
    update(true, RAMP_AFTER_COUNT_IN);
    expect(seen.rows).toBe(2);
  });

  it('reserves no row for a count-in armed mid-run, which only runs on Start', () => {
    const update = mount(false, OFF);
    update(true, OFF);
    expect(seen.rows).toBe(0);
    update(true, { ...OFF, countIn: { ...OFF.countIn, bars: 2 } });
    expect(seen.rows).toBe(0);
  });

  it('reads the played rows when the screen mounts on a running engine', () => {
    mount(true, RAMP_AFTER_COUNT_IN);
    expect(seen.rows).toBe(1);
  });
});
