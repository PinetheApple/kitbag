import { metronome, space, stemPlayer } from '@kitbag/core-design';

export const COMPACT_PAD_FLOOR = stemPlayer.playButton;
export const PAD_SLOT_BOTTOM = space.sectionGap;

export interface PadFitInputs {
  readonly region: number;
  readonly slot: number;
  readonly bpmCardBottom: number;
}

export function compactPadHeight({
  region,
  slot,
  bpmCardBottom,
}: PadFitInputs): number | null {
  if (region === 0 || slot === 0 || bpmCardBottom === 0) return null;
  const windowNeeded = bpmCardBottom + metronome.scrollFade;
  if (region - slot >= windowNeeded) return null;
  return Math.max(COMPACT_PAD_FLOOR, region - windowNeeded - PAD_SLOT_BOTTOM);
}
