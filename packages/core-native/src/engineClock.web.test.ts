import { expect, it } from 'vitest';

import { getEngineClockPair } from './engineClock.web.ts';

it('has no engine clock on web', () => {
  expect(getEngineClockPair()).toBeNull();
});
