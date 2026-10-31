import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStepRepeat, STEP_REPEAT } from './stepRepeat.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('step repeat', () => {
  it('steps on every interval while held, from the long press on', () => {
    const steps: number[] = [];
    const repeat = createStepRepeat();
    repeat.hold(() => steps.push(1));
    expect(steps).toHaveLength(1);
    vi.advanceTimersByTime(STEP_REPEAT.intervalMs * 3);
    expect(steps).toHaveLength(4);
  });

  it('stops stepping on release', () => {
    const steps: number[] = [];
    const repeat = createStepRepeat();
    repeat.hold(() => steps.push(1));
    repeat.release();
    vi.advanceTimersByTime(STEP_REPEAT.intervalMs * 5);
    expect(steps).toHaveLength(1);
  });

  it('runs one repeat at a time', () => {
    const steps: number[] = [];
    const repeat = createStepRepeat();
    repeat.hold(() => steps.push(1));
    repeat.hold(() => steps.push(-1));
    vi.advanceTimersByTime(STEP_REPEAT.intervalMs);
    expect(steps).toEqual([1, -1, -1]);
  });
});
