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

// The single-song player has no countEndFrame: it never counts in.
export function songTransportShown(
  state: Pick<
    StemPlayerState,
    'title' | 'artist' | 'durationFrames' | 'engineRate'
  > &
    Partial<Pick<StemPlayerState, 'countEndFrame'>>,
): SongTransportShowState {
  return {
    playing: true,
    countingIn: state.countEndFrame != null,
    title: state.title,
    artist: state.artist,
    durationFrames: state.durationFrames,
    restartFromFrame: restartFromFrame(state.durationFrames, state.engineRate),
    skipSeconds: SKIP_SECONDS,
  };
}
