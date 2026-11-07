import { stemPlayer, stemSections } from '@kitbag/core-design';

// Rounding can leave a fitting body a fraction of a dp over.
const OVERFLOW_SLOP_DP = 1;
const LINES_TO_READ = 2;

export function overflows(viewport: number, content: number): boolean {
  return viewport > 0 && content - viewport > OVERFLOW_SLOP_DP;
}

export function pinnedLinesFit(
  body: number,
  controls: number,
  currentLine: number,
): boolean {
  if (body === 0 || controls === 0) return true;
  const room = body - controls - stemSections.retimeGap - stemPlayer.bodyGap;
  const needed =
    currentLine === 0
      ? 0
      : LINES_TO_READ * currentLine + 2 * stemSections.currentMargin;
  return room >= needed;
}
