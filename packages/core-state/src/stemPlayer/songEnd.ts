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
  'status' | 'durationFrames' | 'engineRate' | 'retime'
>;

// The end count lags the mixer by up to a card tick; by then a press may have
// restarted the song or another song may have opened.
export function endedOnLastFrame(
  song: EndSlice,
  engine: StemPlayerEngine,
  counting: boolean,
): boolean {
  if (song.status !== 'ready' || song.retime.kind === 'recording') return false;
  if (counting || engine.playing()) return false;
  return (
    engine.position() >= restartFromFrame(song.durationFrames, song.engineRate)
  );
}

interface EndedIn {
  readonly session: number;
  readonly unopened: boolean;
}

export function songEnds(ended: () => boolean, session: () => number) {
  const listeners = new Set<() => void>();
  let from: EndedIn | null = null;
  const current = () => from !== null && from.session === session();
  return {
    reported: () => {
      if (!ended()) return;
      from = { session: session(), unopened: false };
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
    stands: () => current() && (from?.unopened === true || ended()),
    gaveUp: () => current() && from?.unopened === true,
    unopened: (opened: number) => {
      from = { session: opened, unopened: true };
    },
    advanced: () => {
      from = null;
    },
  };
}

export type SongEnds = ReturnType<typeof songEnds>;

export interface AdvanceSteps {
  readonly ends: SongEnds;
  readonly begin: (setId: number) => number;
  readonly load: (opened: number, setId: number) => Promise<void>;
  readonly live: (opened: number) => boolean;
  readonly ready: () => boolean;
  readonly play: () => void;
}

export async function advanceSong(
  steps: AdvanceSteps,
  setId: number,
): Promise<AdvanceOutcome> {
  if (!steps.ends.stands()) return ADVANCE_OUTCOME.displaced;
  const opened = steps.begin(setId);
  await steps.load(opened, setId);
  if (!steps.live(opened)) return ADVANCE_OUTCOME.displaced;
  if (!steps.ready()) {
    steps.ends.unopened(opened);
    return ADVANCE_OUTCOME.unplayable;
  }
  steps.ends.advanced();
  steps.play();
  return ADVANCE_OUTCOME.playing;
}
