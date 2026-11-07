import { stemPlayer } from '@kitbag/core-design';

export type LoopNotePlacement = 'right' | 'left' | 'above';

export interface LaneGeometry {
  readonly laneWidth: number;
  readonly barLeft: number;
  readonly barWidth: number;
}

export interface LoopNoteInput extends LaneGeometry {
  readonly noteWidth: number;
  readonly start: number | null;
  readonly end: number | null;
}

// A hangs left of its line and B right of its own, so the flags span past both.
export function loopNotePlacement({
  laneWidth,
  barLeft,
  barWidth,
  noteWidth,
  start,
  end,
}: LoopNoteInput): LoopNotePlacement {
  if (start === null || laneWidth === 0) return 'right';
  const flag = stemPlayer.loopFlagWidth;
  const clear = stemPlayer.loopNoteGap;
  const flagsLeft = barLeft + start * barWidth - flag;
  const flagsRight =
    end === null ? flagsLeft + flag : barLeft + end * barWidth + flag;
  if (laneWidth - noteWidth >= flagsRight + clear) return 'right';
  return noteWidth + clear <= flagsLeft ? 'left' : 'above';
}

export function aboveFlagsPadding(noteHeight: number): number {
  const riseToFlag = -(stemPlayer.loopTintInset + stemPlayer.loopFlagTop);
  return stemPlayer.loopNoteTop + noteHeight + riseToFlag;
}
