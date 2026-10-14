import { KB_TUNER_IDLE_SLEEP_MICROS } from '@kitbag/core-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { busyRetryDelay } from './commands.ts';

const MICROS_PER_MS = 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe('busyRetryDelay', () => {
  it('waits at least one analysis-thread idle sleep', async () => {
    vi.useFakeTimers();
    let done = false;
    void busyRetryDelay().then(() => {
      done = true;
    });
    const sleepMs = KB_TUNER_IDLE_SLEEP_MICROS / MICROS_PER_MS;
    await vi.advanceTimersByTimeAsync(sleepMs - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
