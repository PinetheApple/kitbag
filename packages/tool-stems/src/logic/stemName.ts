import { grownTextScale, stemPlayer } from '@kitbag/core-design';

export function stemNameWidth(fontScale: number): number {
  return stemPlayer.nameWidth * grownTextScale(fontScale);
}
