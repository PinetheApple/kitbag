import type { PolyRatio } from '@kitbag/core-plugin-api';

export type { PolyRatio };

export function polyRatioLabel(ratio: PolyRatio): string {
  return `${String(ratio.polyBeats)}:${String(ratio.against)}`;
}
