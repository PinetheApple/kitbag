import { describe, expect, it } from 'vitest';

import {
  type EngineClockPair,
  readEngineClockPair,
  renderedFrameToMonotonicMs,
} from './engineClock.ts';
import type { EngineClockHost } from './KitbagHostObject.ts';

const ENGINE_RATE = 48_000;
const OTHER_RATE = 44_100;

const pair: EngineClockPair = {
  frame: 96_000,
  monotonicNs: 5_000_123_456_789,
  sampleRate: ENGINE_RATE,
};

const later: EngineClockPair = {
  frame: 96_480,
  monotonicNs: 5_000_133_501_234,
  sampleRate: ENGINE_RATE,
};

type Pair = Pick<EngineClockPair, 'frame' | 'monotonicNs'>;

function hostPublishingAfterFrameReads(
  first: Pair,
  ...next: Pair[]
): EngineClockHost {
  let current = first;
  return {
    engine_sample_rate: ENGINE_RATE,
    get clock_pair_frame() {
      const { frame } = current;
      current = next.shift() ?? current;
      return frame;
    },
    get clock_pair_monotonic_ns() {
      return current.monotonicNs;
    },
  };
}

function steadyHost(frame: number, monotonicNs: number): EngineClockHost {
  return {
    engine_sample_rate: ENGINE_RATE,
    clock_pair_frame: frame,
    clock_pair_monotonic_ns: monotonicNs,
  };
}

describe('renderedFrameToMonotonicMs', () => {
  it('maps the pair frame to the pair time in ms', () => {
    expect(renderedFrameToMonotonicMs(pair.frame, pair)).toBeCloseTo(
      5_000_123.456789,
      6,
    );
  });

  it('puts a later frame later by frames over the engine rate', () => {
    expect(renderedFrameToMonotonicMs(pair.frame + 30_000, pair)).toBeCloseTo(
      5_000_748.456789,
      6,
    );
  });

  it('puts an earlier frame earlier', () => {
    expect(renderedFrameToMonotonicMs(pair.frame - 12_000, pair)).toBeCloseTo(
      4_999_873.456789,
      6,
    );
  });

  it('uses the pair rate, not a fixed 48 kHz', () => {
    const at44k: EngineClockPair = { ...pair, sampleRate: OTHER_RATE };
    expect(renderedFrameToMonotonicMs(pair.frame + 30_000, at44k)).toBeCloseTo(
      5_000_803.728898,
      6,
    );
  });
});

describe('readEngineClockPair', () => {
  it('returns the frame, time and rate of one pair', () => {
    expect(
      readEngineClockPair(steadyHost(pair.frame, pair.monotonicNs)),
    ).toEqual(pair);
  });

  it('never pairs one callback frame with the next callback time', () => {
    const host = hostPublishingAfterFrameReads(pair, later);
    expect(readEngineClockPair(host)).toEqual(later);
  });

  it('gives up rather than spin while every read is overwritten', () => {
    const churn = Array.from({ length: 16 }, (_, index) => ({
      frame: pair.frame + (index + 1) * 480,
      monotonicNs: pair.monotonicNs + (index + 1) * 10_000_000,
    }));
    expect(
      readEngineClockPair(hostPublishingAfterFrameReads(pair, ...churn)),
    ).toBeNull();
  });

  it('reports no pair before the first render callback', () => {
    expect(readEngineClockPair(steadyHost(Number.NaN, Number.NaN))).toBeNull();
  });
});
