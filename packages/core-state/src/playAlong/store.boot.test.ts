import { afterEach, expect, it, vi } from 'vitest';

import { fakePlayAlong } from './store.test-helper.ts';

afterEach(() => {
  vi.useRealTimers();
});

it('reads no media sessions while it is created, so app start can configure them later', () => {
  expect(fakePlayAlong().sessionsRead).not.toHaveBeenCalled();
});
