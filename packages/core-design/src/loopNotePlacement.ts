import { flagHang, LOOP_FLAG_TOP } from './loopHandleFrame.ts';
import { stemPlayer } from './stemPlayerRoles.ts';

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

export function loopNotePlacement({
  laneWidth,
  barLeft,
  barWidth,
  noteWidth,
  start,
  end,
}: LoopNoteInput): LoopNotePlacement {
  if (start === null || laneWidth === 0) return 'right';
  const clearance = stemPlayer.loopNoteFlagClearance;
  const startLine = barLeft + start * barWidth;
  const startFlagLeft = startLine - flagHang('start');
  const endFlagRight =
    end === null
      ? startLine
      : barLeft + end * barWidth + stemPlayer.loopFlagWidth;
  if (laneWidth - noteWidth >= endFlagRight + clearance) return 'right';
  return noteWidth + clearance <= startFlagLeft ? 'left' : 'above';
}

export function aboveFlagsPadding(noteHeight: number): number {
  const riseToFlag = -LOOP_FLAG_TOP;
  return stemPlayer.loopNoteTop + noteHeight + riseToFlag;
}
