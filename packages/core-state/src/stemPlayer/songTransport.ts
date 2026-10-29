import type { SongTransportShowState } from '@kitbag/core-native';

import type { StemPlayerState } from './store.ts';
import { secondsToFrames } from './time.ts';

export const SKIP_SECONDS = 10;

// Within this of the end, play starts the song over: the mixer stops on the
// last frame, so a press there would otherwise play nothing.
export const END_SLACK_SECONDS = 0.25;

export function restartFromFrame(
  durationFrames: number,
  engineRate: number,
): number {
  return durationFrames - secondsToFrames(END_SLACK_SECONDS, engineRate);
}

export function songTransportShown(
  state: Pick<
    StemPlayerState,
    'title' | 'artist' | 'durationFrames' | 'engineRate'
  >,
): SongTransportShowState {
  return {
    playing: true,
    title: state.title,
    artist: state.artist,
    durationFrames: state.durationFrames,
    restartFromFrame: restartFromFrame(state.durationFrames, state.engineRate),
    skipSeconds: SKIP_SECONDS,
  };
}
