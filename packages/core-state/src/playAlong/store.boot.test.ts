import { afterEach, expect, it, vi } from 'vitest';

import { initialConfig } from '../metronome/store.ts';
import { fakePlayAlong } from './store.test-helper.ts';

afterEach(() => {
  vi.useRealTimers();
});

it('reads no media sessions while it is created, so app start can configure them later', () => {
  expect(fakePlayAlong().sessionsRead).not.toHaveBeenCalled();
});

it('reads no latency setting until it enters its slot', () => {
  const fake = fakePlayAlong();
  expect(fake.latencyRead).not.toHaveBeenCalled();
  expect(fake.latencyListeners()).toBe(0);
  expect(fake.store.getState().latencyOffsetMs).toBe(
    initialConfig().latencyOffset,
  );
});
