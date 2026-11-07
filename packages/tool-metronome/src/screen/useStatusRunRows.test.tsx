// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PRACTICE_OFF } from '../logic/fixtures.test-helper.ts';
import type { PracticeSettings } from '../logic/statusRows.ts';

type CountInReaction = (now: boolean, before: boolean | null) => void;

const worklet = vi.hoisted(() => ({
  frame: null as (() => void) | null,
  active: false,
  prepare: null as (() => boolean) | null,
  react: null as CountInReaction | null,
  before: null as boolean | null,
  crossings: 0,
}));

vi.mock('@kitbag/core-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...(await import('../../../core-native/src/host/KitbagHostObject.ts')),
}));

vi.mock('react-native-reanimated', async () => {
  const { useState } = await import('react');
  return {
    useSharedValue: (value: unknown) => useState(() => ({ value }))[0],
    useFrameCallback: (run: () => void) => {
      worklet.frame = run;
      return {
        setActive: (active: boolean) => {
          worklet.active = active;
        },
      };
    },
    useAnimatedReaction: (prepare: () => boolean, react: CountInReaction) => {
      worklet.prepare = prepare;
      worklet.react = react;
    },
  };
});

vi.mock('react-native-worklets', () => ({
  scheduleOnRN: (run: (arg: unknown) => void, arg: unknown) => {
    worklet.crossings += 1;
    run(arg);
  },
}));

const { KB_STOPPED_BEAT: STOPPED, KITBAG_HOST_OBJECT_KEY: HOST_KEY } =
  await import('../../../core-native/src/host/KitbagHostObject.ts');
const { useMetronomeFrame } = await import('./useMetronomeFrame.ts');
const { useStatusRunRows } = await import('./useStatusRunRows.ts');

const RAMP_AFTER_COUNT_IN: PracticeSettings = {
  ...PRACTICE_OFF,
  ramp: { ...PRACTICE_OFF.ramp, enabled: true },
  countIn: { ...PRACTICE_OFF.countIn, bars: 2 },
};
const COUNT_IN_ROWS = 2;
const PLAYED_ROWS = 1;
const BPM = 120;
const FIRST_BEAT = 0;
const SECOND_BEAT = 1;

const seen = { rows: -1 };

function Probe(props: {
  readonly running: boolean;
  readonly settings: PracticeSettings;
}) {
  const frame = useMetronomeFrame(props.running, BPM);
  seen.rows = useStatusRunRows(frame.beatPlayed, props.running, props.settings);
  return null;
}

function setRunning(
  screen: ReactTestRenderer,
  running: boolean,
  settings: PracticeSettings = RAMP_AFTER_COUNT_IN,
) {
  act(() => {
    screen.update(createElement(Probe, { running, settings }));
  });
}

function mountStopped(
  settings: PracticeSettings = RAMP_AFTER_COUNT_IN,
  running = false,
): ReactTestRenderer {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const mounted: { screen?: ReactTestRenderer } = {};
  act(() => {
    mounted.screen = create(createElement(Probe, { running, settings }));
  });
  if (mounted.screen === undefined) throw new Error('probe did not mount');
  return mounted.screen;
}

function frameReads(currentBeat: number, countingIn: 0 | 1) {
  (globalThis as Record<string, unknown>)[HOST_KEY] = new Proxy(
    { current_beat: currentBeat, counting_in: countingIn },
    { get: (reads, name): unknown => Reflect.get(reads, name) ?? 0 },
  );
  act(() => {
    if (worklet.active) worklet.frame?.();
    const now = worklet.prepare?.() ?? false;
    worklet.react?.(now, worklet.before);
    worklet.before = now;
  });
}

beforeEach(() => {
  worklet.before = null;
  worklet.crossings = 0;
  worklet.active = false;
});

describe('useStatusRunRows', () => {
  it('holds the count-in rows through a real count-in, then drops once', () => {
    const screen = mountStopped();
    setRunning(screen, true);
    const rows: number[] = [seen.rows];
    const reads: readonly (readonly [number, 0 | 1])[] = [
      [STOPPED, 0],
      [FIRST_BEAT, 0],
      [FIRST_BEAT, 1],
      [SECOND_BEAT, 1],
      [FIRST_BEAT, 1],
      [FIRST_BEAT, 0],
    ];
    for (const [beat, counting] of reads) {
      frameReads(beat, counting);
      rows.push(seen.rows);
    }
    expect(rows).toEqual(Array(rows.length).fill(COUNT_IN_ROWS));
    frameReads(FIRST_BEAT, 0);
    expect(seen.rows).toBe(PLAYED_ROWS);
    expect(worklet.crossings).toBe(1);
  });

  it('does not end a count-in on the read that straddles its first block', () => {
    const screen = mountStopped();
    setRunning(screen, true);
    frameReads(FIRST_BEAT, 0);
    frameReads(FIRST_BEAT, 1);
    expect(seen.rows).toBe(COUNT_IN_ROWS);
    expect(worklet.crossings).toBe(0);
  });

  it('drops the count-in rows on Pause then resume, which never counts in', () => {
    const screen = mountStopped();
    setRunning(screen, true);
    frameReads(FIRST_BEAT, 0);
    frameReads(FIRST_BEAT, 0);
    expect(seen.rows).toBe(PLAYED_ROWS);
    setRunning(screen, false);
    frameReads(STOPPED, 0);
    setRunning(screen, true);
    expect(seen.rows).toBe(COUNT_IN_ROWS);
    frameReads(STOPPED, 0);
    frameReads(FIRST_BEAT, 0);
    frameReads(FIRST_BEAT, 0);
    expect(seen.rows).toBe(PLAYED_ROWS);
  });

  it('drops the count-in rows on a run with no count-in edge at all', () => {
    const screen = mountStopped();
    setRunning(screen, true);
    frameReads(STOPPED, 0);
    expect(seen.rows).toBe(COUNT_IN_ROWS);
    frameReads(FIRST_BEAT, 0);
    frameReads(SECOND_BEAT, 0);
    expect(seen.rows).toBe(PLAYED_ROWS);
  });

  it('crosses to JS once however long the run plays', () => {
    const screen = mountStopped();
    setRunning(screen, true);
    for (let bar = 0; bar < 8; bar += 1) frameReads(bar, 0);
    expect(worklet.crossings).toBe(1);
  });

  it('holds the count-in rows on the Start after a Stop during a count-in', () => {
    const screen = mountStopped();
    setRunning(screen, true);
    frameReads(FIRST_BEAT, 1);
    setRunning(screen, false);
    frameReads(STOPPED, 0);
    setRunning(screen, true);
    frameReads(STOPPED, 0);
    frameReads(FIRST_BEAT, 1);
    expect(seen.rows).toBe(COUNT_IN_ROWS);
  });

  it('holds the count-in rows on a Start after a run that played', () => {
    const screen = mountStopped();
    setRunning(screen, true);
    frameReads(FIRST_BEAT, 0);
    frameReads(FIRST_BEAT, 0);
    setRunning(screen, false);
    setRunning(screen, true);
    expect(seen.rows).toBe(COUNT_IN_ROWS);
  });

  it('ignores engine reads while stopped', () => {
    const screen = mountStopped();
    frameReads(FIRST_BEAT, 0);
    frameReads(FIRST_BEAT, 0);
    expect(worklet.crossings).toBe(0);
    setRunning(screen, true);
    expect(seen.rows).toBe(COUNT_IN_ROWS);
  });

  it('reserves no row for a count-in armed once the run has played', () => {
    const screen = mountStopped(PRACTICE_OFF);
    setRunning(screen, true, PRACTICE_OFF);
    frameReads(FIRST_BEAT, 0);
    frameReads(FIRST_BEAT, 0);
    setRunning(screen, true, {
      ...PRACTICE_OFF,
      countIn: { ...PRACTICE_OFF.countIn, bars: 2 },
    });
    expect(seen.rows).toBe(0);
  });

  it('reads the played rows soon after mounting on a running engine', () => {
    mountStopped(RAMP_AFTER_COUNT_IN, true);
    frameReads(SECOND_BEAT, 0);
    frameReads(SECOND_BEAT, 0);
    expect(seen.rows).toBe(PLAYED_ROWS);
  });
});
