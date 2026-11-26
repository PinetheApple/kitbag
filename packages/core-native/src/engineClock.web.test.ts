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

it('passes a touch time through unchanged on web', () => {
  const touchMs = 1234.5;
  expect(uptimeToBoottimeMs(touchMs)).toBe(touchMs);
});
