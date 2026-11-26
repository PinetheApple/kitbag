import { expect, it } from 'vitest';

import {
  boottimeNowMs,
  engineFrameAtBoottimeMs,
  getEngineClockPair,
  uptimeToBoottimeMs,
} from './engineClock.web.ts';

it('has no engine clock on web', () => {
  expect(getEngineClockPair()).toBeNull();
  expect(boottimeNowMs()).toBeNaN();
  expect(engineFrameAtBoottimeMs(1)).toBeNull();
});

it('has no boottime for a touch on web', () => {
  expect(uptimeToBoottimeMs(1)).toBeNaN();
});
