import { describe, expect, it } from 'vitest';

import {
  type EngineClockPair,
  readEngineClockPair,
  readFrameAtBoottimeMs,
  readUptimeToBoottimeMs,
  renderedFrameToMonotonicMs,
} from './engineClock.ts';
import type { BoottimeClockHost, EngineClockHost } from './KitbagHostObject.ts';

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

describe('readFrameAtBoottimeMs', () => {
  const REPORTED_AT_MS = 98_765_432.125;
  const MAPPED_FRAME = 4_740_741;
  const NO_DEEP_SLEEP_MS = 0;

  function mappingHost(frameFor: (ms: number) => number): BoottimeClockHost {
    return {
      boottime_ms: REPORTED_AT_MS,
      frame_at_boottime_ms: frameFor,
      boottime_minus_uptime_ms: NO_DEEP_SLEEP_MS,
    };
  }

  it('passes the instant through and returns its frame', () => {
    const asked: number[] = [];
    const host = mappingHost((ms) => {
      asked.push(ms);
      return MAPPED_FRAME;
    });
    expect(readFrameAtBoottimeMs(host, REPORTED_AT_MS)).toBe(MAPPED_FRAME);
    expect(asked).toEqual([REPORTED_AT_MS]);
  });

  it('reports no frame before the first render callback', () => {
    expect(
      readFrameAtBoottimeMs(
        mappingHost(() => Number.NaN),
        REPORTED_AT_MS,
      ),
    ).toBeNull();
  });
});

describe('readUptimeToBoottimeMs', () => {
  const TOUCH_UPTIME_MS = 7_200_123.5;
  const AWAKE_GAP_MS = 0.25;
  const AFTER_DEEP_SLEEP_GAP_MS = 3_600_000.25;

  function gapHost(...gaps: number[]) {
    return {
      get boottime_minus_uptime_ms() {
        return gaps.shift() ?? Number.NaN;
      },
    };
  }

  it('adds the time the device spent in deep sleep', () => {
    expect(
      readUptimeToBoottimeMs(gapHost(AFTER_DEEP_SLEEP_GAP_MS), TOUCH_UPTIME_MS),
    ).toBe(TOUCH_UPTIME_MS + AFTER_DEEP_SLEEP_GAP_MS);
  });

  it('reads the gap again on every call, since a deep sleep widens it', () => {
    const host = gapHost(AWAKE_GAP_MS, AFTER_DEEP_SLEEP_GAP_MS);
    readUptimeToBoottimeMs(host, TOUCH_UPTIME_MS);
    expect(readUptimeToBoottimeMs(host, TOUCH_UPTIME_MS)).toBe(
      TOUCH_UPTIME_MS + AFTER_DEEP_SLEEP_GAP_MS,
    );
  });
});
