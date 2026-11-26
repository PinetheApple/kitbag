import { expect, it } from 'vitest';

import {
  boottimeNowMs,
  engineFrameAtBoottimeMs,
  getEngineClockPair,
} from './engineClock.web.ts';

it('has no engine clock on web', () => {
  expect(getEngineClockPair()).toBeNull();
  expect(boottimeNowMs()).toBeNaN();
  expect(engineFrameAtBoottimeMs(1)).toBeNull();
});
