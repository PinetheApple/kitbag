import type { LaneGeometry } from './loopNotePlacement.ts';

export const LANE = {
  '360 at 1.0': { laneWidth: 328, barLeft: 57, barWidth: 215 },
  '411 at 1.0': { laneWidth: 379, barLeft: 57, barWidth: 266 },
  '360 at 2.0': { laneWidth: 328, barLeft: 82, barWidth: 164 },
  '411 at 2.0': { laneWidth: 379, barLeft: 82, barWidth: 215 },
} as const satisfies Record<string, LaneGeometry>;

// Read off the emulator shots of "Outro · 4:08 – 5:11".
export const NOTE_AT_1X = 121;
export const NOTE_AT_2X = 234;
