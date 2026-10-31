import { countLabel } from '@kitbag/core-design';
import { KB_POLY_AGAINST_BAR } from '@kitbag/core-native';
import { effectivePolyAgainst } from '@kitbag/core-state';

export interface PolyRatio {
  readonly polyBeats: number;
  readonly against: number;
  readonly beatsPerBar: number;
}

export interface PolyPulse {
  readonly beat: number;
  readonly slot: number;
  readonly cycle: number;
}

export interface PolyCycleSpan {
  readonly cycle: number;
  readonly start: number;
  readonly end: number;
}

export interface PolyBar {
  readonly pulses: readonly PolyPulse[];
  readonly spans: readonly PolyCycleSpan[];
}

export interface PolyRowGeometry {
  readonly lineWidth: number;
  readonly dotSize: number;
  readonly dotGap: number;
}

export const NO_CYCLE = -1;

export function polyCycleOffset(
  downbeatPhase: number,
  against: number,
): number {
  'worklet';
  if (!(downbeatPhase >= 0)) return 0;
  return Math.round(downbeatPhase * against) % against;
}

export function soundingCycle(
  currentBeat: number,
  offset: number,
  against: number,
): number {
  'worklet';
  if (currentBeat < 0) return NO_CYCLE;
  return Math.floor((currentBeat + offset) / against);
}

// Pulse times are kept as whole numerators over polyBeats so bar edges compare exactly.
export function polyBar(ratio: PolyRatio, offset: number): PolyBar {
  const { polyBeats, against, beatsPerBar } = ratio;
  const barEnd = beatsPerBar * polyBeats;
  const pulses: PolyPulse[] = [];
  const spans: PolyCycleSpan[] = [];
  for (let cycle = 0; cycle * against - offset < beatsPerBar; cycle++) {
    const start = cycle * against - offset;
    spans.push({
      cycle,
      start: Math.max(start, 0),
      end: Math.min(start + against, beatsPerBar),
    });
    for (let slot = 0; slot < polyBeats; slot++) {
      const numerator = start * polyBeats + slot * against;
      if (numerator >= 0 && numerator < barEnd)
        pulses.push({ beat: numerator / polyBeats, slot, cycle });
    }
  }
  return { pulses, spans };
}

// Bar n starts n * beatsPerBar beats into the cycle, so only these offsets are ever drawn.
export function polyBarOffsets(ratio: PolyRatio): readonly number[] {
  const offsets = new Set<number>();
  for (let bar = 0; bar < ratio.against; bar++) {
    offsets.add((bar * ratio.beatsPerBar) % ratio.against);
  }
  return [...offsets];
}

export function polyBarTable(ratio: PolyRatio): readonly PolyBar[] {
  return Array.from({ length: ratio.against }, (_u, offset) =>
    polyBar(ratio, offset),
  );
}

export function polyX(
  beat: number,
  beatsPerBar: number,
  row: PolyRowGeometry,
): number {
  return row.dotSize / 2 + (beat / beatsPerBar) * (row.lineWidth + row.dotGap);
}

export function polySpanPlace(
  span: PolyCycleSpan,
  beatsPerBar: number,
  row: PolyRowGeometry,
): { readonly left: number; readonly width: number } {
  const left = polyX(span.start, beatsPerBar, row);
  return { left, width: polyX(span.end, beatsPerBar, row) - left };
}

export function polyLastDotRight(
  ratio: PolyRatio,
  row: PolyRowGeometry,
  dotSize: number,
): number {
  const centres = polyBarOffsets(ratio).flatMap((offset) =>
    polyBar(ratio, offset).pulses.map((pulse) =>
      polyX(pulse.beat, ratio.beatsPerBar, row),
    ),
  );
  return Math.max(...centres) + dotSize / 2;
}

export function polySpanInArea(
  span: PolyCycleSpan,
  beatsPerBar: number,
  row: PolyRowGeometry,
  areaWidth: number,
): { readonly left: number; readonly width: number } {
  const place = polySpanPlace(span, beatsPerBar, row);
  const areaRight =
    row.lineWidth + Math.max(0, (areaWidth - row.lineWidth) / 2);
  const right = Math.min(place.left + place.width, areaRight);
  return { left: place.left, width: right - place.left };
}

export function polyDotSize(
  ratio: PolyRatio,
  row: PolyRowGeometry,
  maxDot: number,
): number {
  const pitch =
    polyX(ratio.against / ratio.polyBeats, ratio.beatsPerBar, row) -
    polyX(0, ratio.beatsPerBar, row);
  return Math.min(maxDot, pitch);
}

export type PolyLabelPlace = 'left' | 'right' | 'above';

export interface PolyLabelRoom {
  readonly labelWidth: number;
  readonly labelHeight: number;
  readonly rowHeight: number;
  readonly labelGap: number;
  readonly sideRoom: number;
  readonly screenInset: number;
  readonly afterLastDot: number;
}

export function polyLabelPlace(room: PolyLabelRoom): PolyLabelPlace {
  if (room.labelHeight > room.rowHeight) return 'above';
  const needed = room.labelWidth + room.labelGap;
  const margin = Math.max(0, room.sideRoom) + room.screenInset;
  if (needed <= room.afterLastDot + margin) return 'right';
  return needed <= margin ? 'left' : 'above';
}

export function polyRatioLabel(ratio: PolyRatio): string {
  return `${String(ratio.polyBeats)}:${String(ratio.against)}`;
}

export interface PolyAgainstLabel {
  readonly value: string;
  readonly suffix: string | undefined;
  readonly spoken: string;
}

export function polyAgainstLabel(
  against: number,
  beatsPerBar: number,
): PolyAgainstLabel {
  const main = effectivePolyAgainst(against, beatsPerBar);
  const count = countLabel(main, 'beat', 'beats');
  return against === KB_POLY_AGAINST_BAR
    ? { value: String(main), suffix: 'bar', spoken: `${count}, the bar` }
    : { value: String(main), suffix: undefined, spoken: count };
}

export interface PolyStripCaption {
  readonly cycle: string;
  readonly span: string;
}

export function polyStripCaption(
  polyBeats: number,
  against: number,
  beatsPerBar: number,
): PolyStripCaption {
  const main = effectivePolyAgainst(against, beatsPerBar);
  return {
    cycle: `one cycle: ${String(polyBeats)} poly over ${String(main)} main`,
    span:
      against === KB_POLY_AGAINST_BAR
        ? 'the bar'
        : `${String(main)} of ${String(beatsPerBar)} beats`,
  };
}
