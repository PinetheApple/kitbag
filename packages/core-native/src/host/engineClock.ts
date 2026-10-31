import type { EngineClockHost } from './KitbagHostObject.ts';

export type EngineClockPair = Readonly<{
  frame: number;
  monotonicNs: number;
  sampleRate: number;
}>;

const NS_PER_MS = 1_000_000;
const MS_PER_SECOND = 1000;
const PAIR_READ_ATTEMPTS = 4;

// Each property is its own native read, so a callback can land between them;
// the pair frame changes with every callback, so an unchanged frame means one pair.
export function readEngineClockPair(
  host: EngineClockHost,
): EngineClockPair | null {
  for (let attempt = 0; attempt < PAIR_READ_ATTEMPTS; attempt += 1) {
    const frame = host.clock_pair_frame;
    const monotonicNs = host.clock_pair_monotonic_ns;
    if (Number.isNaN(frame) || Number.isNaN(monotonicNs)) return null;
    if (host.clock_pair_frame === frame) {
      return { frame, monotonicNs, sampleRate: host.engine_sample_rate };
    }
  }
  return null;
}

/** CLOCK_MONOTONIC ms at which the engine rendered frame, the base of a touch nativeEvent.timestamp. */
export function renderedFrameToMonotonicMs(
  frame: number,
  pair: EngineClockPair,
): number {
  const sinceFrameMs = ((frame - pair.frame) * MS_PER_SECOND) / pair.sampleRate;
  return pair.monotonicNs / NS_PER_MS + sinceFrameMs;
}
