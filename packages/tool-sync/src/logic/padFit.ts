import { metronome, space, stemPlayer } from '@kitbag/core-design';

export const COMPACT_PAD_FLOOR = stemPlayer.playButton;
export const PAD_SLOT_BOTTOM = space.sectionGap;

export interface PadFitInputs {
  readonly region: number;
  readonly slot: number;
  readonly bpmCard: number;
}

export function compactPadHeight({
  region,
  slot,
  bpmCard,
}: PadFitInputs): number | null {
  if (region === 0 || slot === 0 || bpmCard === 0) return null;
  const windowNeeded = bpmCard + metronome.scrollFade;
  if (region - slot >= windowNeeded) return null;
  return Math.max(COMPACT_PAD_FLOOR, region - windowNeeded - PAD_SLOT_BOTTOM);
}
