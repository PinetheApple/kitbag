import type * as Native from './engineClock.ts';

export const getEngineClockPair: typeof Native.getEngineClockPair = () => null;

export const boottimeNowMs: typeof Native.boottimeNowMs = () => Number.NaN;

export const engineFrameAtBoottimeMs: typeof Native.engineFrameAtBoottimeMs =
  () => null;

export const uptimeToBoottimeMs: typeof Native.uptimeToBoottimeMs = () =>
  Number.NaN;
