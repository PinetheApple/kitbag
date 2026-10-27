import { describe, expect, it } from 'vitest';

import {
  IDLE_PRACTICE,
  practiceAfterRunning,
  practiceElapsedMs,
  resetPracticeClock,
} from './practice.ts';

describe('practice clock', () => {
  it('counts only while running and keeps the total across stretches', () => {
    let clock = practiceAfterRunning(IDLE_PRACTICE, true, 1_000);
    expect(practiceElapsedMs(clock, 4_000)).toBe(3_000);
    clock = practiceAfterRunning(clock, false, 5_000);
    expect(practiceElapsedMs(clock, 60_000)).toBe(4_000);
    clock = practiceAfterRunning(clock, true, 70_000);
    expect(practiceElapsedMs(clock, 72_000)).toBe(6_000);
  });

  it('a repeated start or stop changes nothing', () => {
    const running = practiceAfterRunning(IDLE_PRACTICE, true, 1_000);
    expect(practiceAfterRunning(running, true, 9_000)).toBe(running);
    expect(practiceAfterRunning(IDLE_PRACTICE, false, 9_000)).toBe(
      IDLE_PRACTICE,
    );
  });

  it('reset zeroes the total and keeps a running stretch going from now', () => {
    const running = practiceAfterRunning(IDLE_PRACTICE, true, 1_000);
    const reset = resetPracticeClock(running, 5_000);
    expect(practiceElapsedMs(reset, 7_000)).toBe(2_000);
    expect(resetPracticeClock(IDLE_PRACTICE, 5_000)).toEqual(IDLE_PRACTICE);
  });
});
