import { stemPlayer, stemSections } from '@kitbag/core-design';

// Rounding can leave a fitting body a fraction of a dp over.
const OVERFLOW_SLOP_DP = 1;

export function overflows(viewport: number, content: number): boolean {
  return viewport > 0 && content - viewport > OVERFLOW_SLOP_DP;
}

export function controlsFit(body: number, controls: number): boolean {
  if (body === 0 || controls === 0) return true;
  return controls + stemSections.retimeGap + stemPlayer.bodyGap <= body;
}
