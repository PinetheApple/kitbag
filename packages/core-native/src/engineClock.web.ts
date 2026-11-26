import type * as Native from './engineClock.ts';

export const getEngineClockPair: typeof Native.getEngineClockPair = () => null;

export const boottimeNowMs: typeof Native.boottimeNowMs = () =>
  performance.now();

export const engineFrameAtBoottimeMs: typeof Native.engineFrameAtBoottimeMs =
  () => null;
