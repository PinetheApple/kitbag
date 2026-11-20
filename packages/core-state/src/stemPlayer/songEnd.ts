import type { StemPlayerEngine } from './runtime.ts';
import { restartFromFrame } from './songTransport.ts';
import type { StemPlayerState } from './store.ts';

export const ADVANCE_OUTCOME = {
  playing: 'playing',
  unplayable: 'unplayable',
  displaced: 'displaced',
} as const;

export type AdvanceOutcome =
  (typeof ADVANCE_OUTCOME)[keyof typeof ADVANCE_OUTCOME];

type EndSlice = Pick<
  StemPlayerState,
  'status' | 'durationFrames' | 'engineRate'
>;

// The end count lags the mixer by up to a card tick; by then a press may have
// restarted the song or another song may have opened.
export function endedOnLastFrame(
  song: EndSlice,
  engine: StemPlayerEngine,
  counting: boolean,
): boolean {
  if (song.status !== 'ready' || counting || engine.playing()) return false;
  return (
    engine.position() >= restartFromFrame(song.durationFrames, song.engineRate)
  );
}

export function songEnds(ended: () => boolean) {
  const listeners = new Set<() => void>();
  return {
    reported: () => {
      if (!ended()) return;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
