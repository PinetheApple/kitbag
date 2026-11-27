import type { SetTempoRules } from './rules.ts';

type Meter = 3 | 4;

const HALVES = 2;
const BOUNDS = { min: 40, max: 240 };

const roundBpm = (bpm: number) =>
  Math.min(Math.max(Math.round(bpm * HALVES) / HALVES, BOUNDS.min), BOUNDS.max);

export const RULES: SetTempoRules<Meter> = {
  bounds: BOUNDS,
  bpmStep: 1 / HALVES,
  tapsToSet: 3,
  minAnchorSeconds: 0,
  msPerSecond: 1000,
  secondsPerMinute: 60,
  meters: [3, 4],
  defaultMeter: 4,
  isMeter: (value): value is Meter => value === 3 || value === 4,
  roundBpm,
  stepBpm: (bpm, steps) => roundBpm(bpm + steps / HALVES),
  pushTap: (taps, atMs) => [...taps, atMs],
  tappedBpm: (taps) => {
    const first = taps[0];
    const last = taps.at(-1);
    if (taps.length < 3 || first === undefined || last === undefined)
      return null;
    return roundBpm((60_000 * (taps.length - 1)) / (last - first));
  },
  minus: '−',
};
