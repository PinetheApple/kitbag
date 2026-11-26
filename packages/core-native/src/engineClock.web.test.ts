import { expect, it } from 'vitest';

import {
  engineFrameAtBoottimeMs,
  getEngineClockPair,
} from './engineClock.web.ts';

it('has no engine clock on web', () => {
  expect(getEngineClockPair()).toBeNull();
  expect(engineFrameAtBoottimeMs(1)).toBeNull();
});
