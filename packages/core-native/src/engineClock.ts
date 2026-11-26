import {
  getBoottimeClockHost,
  getEngineClockHost,
} from './host/KitbagHostObject.ts';
import {
  type EngineClockPair,
  readEngineClockPair,
  readFrameAtBoottimeMs,
} from './host/engineClock.ts';

export function getEngineClockPair(): EngineClockPair | null {
  return readEngineClockPair(getEngineClockHost());
}

export function boottimeNowMs(): number {
  return getBoottimeClockHost().boottime_ms;
}

export function engineFrameAtBoottimeMs(boottimeMs: number): number | null {
  return readFrameAtBoottimeMs(getBoottimeClockHost(), boottimeMs);
}
