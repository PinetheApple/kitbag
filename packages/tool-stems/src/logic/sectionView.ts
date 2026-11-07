import { clampUnit, grownTextScale, stemSections } from '@kitbag/core-design';
import {
  formatClockSeconds,
  framesToSeconds,
  type LoopState,
  type StemPlayerStore,
} from '@kitbag/core-state';

interface SectionTimes {
  readonly startSec: number;
  readonly endSec: number;
}

export type StemSection = StemPlayerStore['sections'][number];

// Stored loop ends are frame-rounded, so they never equal a section end exactly.
const SAME_END_SEC = 0.001;
const TEXT_ROOM =
  stemSections.cardWidth - stemSections.cardLeft - stemSections.loopKey;

export function songSeconds({
  durationFrames,
  engineRate,
}: {
  readonly durationFrames: number;
  readonly engineRate: number;
}): number {
  return framesToSeconds(durationFrames, engineRate);
}

export function sectionRange({ startSec, endSec }: SectionTimes): string {
  return `${formatClockSeconds(startSec)}–${formatClockSeconds(endSec)}`;
}

export function sectionBoundaryFractions(
  sections: readonly SectionTimes[],
  durationSec: number,
): number[] {
  if (durationSec <= 0) return [];
  const edges = new Set(
    sections.flatMap(({ startSec, endSec }) => [startSec, endSec]),
  );
  return [...edges]
    .filter((edge) => edge > 0 && edge < durationSec)
    .sort((a, b) => a - b)
    .map((edge) => edge / durationSec);
}

export function sectionProgress(
  songSec: number,
  { startSec, endSec }: SectionTimes,
): number {
  'worklet';
  const length = endSec - startSec;
  if (length <= 0) return 0;
  return clampUnit((songSec - startSec) / length);
}

export function isSectionLoop(
  loop: LoopState,
  { startSec, endSec }: SectionTimes,
  durationSec: number,
): boolean {
  if (loop.kind !== 'on' || loop.startSec !== startSec) return false;
  return Math.abs(loop.endSec - Math.min(endSec, durationSec)) < SAME_END_SEC;
}

export function loopNoteText(
  loop: LoopState,
  sections: readonly StemSection[],
  durationSec: number,
): string | null {
  if (loop.kind === 'off') return null;
  if (loop.kind === 'armed')
    return `Loop from ${formatClockSeconds(loop.startSec)}`;
  const range = `${formatClockSeconds(loop.startSec)} – ${formatClockSeconds(loop.endSec)}`;
  const section = sections.find((s) => isSectionLoop(loop, s, durationSec));
  return section === undefined ? `Loop ${range}` : `${section.name} · ${range}`;
}

export function undoMessage(loop: LoopState): string {
  return loop.kind === 'on' ? 'Loop replaced' : 'Loop cleared';
}

export function sectionCardWidth(fontScale: number): number {
  return stemSections.cardWidth + TEXT_ROOM * (grownTextScale(fontScale) - 1);
}
