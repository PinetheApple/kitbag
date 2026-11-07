import type { PlayPauseButtonProps, ScrubFrame } from '@kitbag/core-design';

export interface SongFrameValues extends ScrubFrame {
  readonly playing: PlayPauseButtonProps['playing'];
}

export type UseSongFrame = (
  engineRate: number,
  durationFrames: number,
  loopEndFrames: number | null,
) => SongFrameValues;
