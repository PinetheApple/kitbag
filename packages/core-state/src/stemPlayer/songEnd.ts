import type { HeldStart } from './loop.ts';
import type { StemPlayerEngine } from './runtime.ts';
import { restartFromFrame } from './songTransport.ts';
import type { StemPlayerState } from './store.ts';

export const ADVANCE_OUTCOME = {
  playing: 'playing',
  stopped: 'stopped',
  paused: 'paused',
  unplayable: 'unplayable',
  displaced: 'displaced',
} as const;

export type AdvanceOutcome =
  (typeof ADVANCE_OUTCOME)[keyof typeof ADVANCE_OUTCOME];

export const START = { playing: 'playing', paused: 'paused' } as const;

export type StartMode = (typeof START)[keyof typeof START];

export type StartById = (
  id: number,
  start?: StartMode,
) => Promise<AdvanceOutcome>;

export type TakeOverById = (
  id: number,
  waveformBars: number,
  held?: HeldStart,
  start?: StartMode,
) => Promise<AdvanceOutcome>;

type EndSlice = Pick<
  StemPlayerState,
  'status' | 'durationFrames' | 'engineRate'
> &
  Partial<Pick<StemPlayerState, 'retime'>>;

// By the time the end report arrives a press may have restarted the song or
// another song may have opened.
export function endedOnLastFrame(
  song: EndSlice,
  engine: StemPlayerEngine,
  counting: boolean,
): boolean {
  if (song.status !== 'ready' || song.retime?.kind === 'recording')
    return false;
  if (counting || engine.playing()) return false;
  return (
    engine.position() >= restartFromFrame(song.durationFrames, song.engineRate)
  );
}

export const ADVANCE_CAUSE = {
  ended: 'ended',
  next: 'next',
  nextInApp: 'nextInApp',
  nextPaused: 'nextPaused',
} as const;

export type AdvanceCause = (typeof ADVANCE_CAUSE)[keyof typeof ADVANCE_CAUSE];

export type AdvanceListener = (cause: AdvanceCause) => void;

const LEFT_BECAUSE = {
  ended: 'ended',
  unopened: 'unopened',
  pressed: 'pressed',
} as const;

interface EndedIn {
  readonly session: number;
  readonly why: (typeof LEFT_BECAUSE)[keyof typeof LEFT_BECAUSE];
}

export function songEnds(ended: () => boolean, session: () => number) {
  const listeners = new Set<AdvanceListener>();
  let from: EndedIn | null = null;
  let stoppedIn: number | null = null;
  const current = () => from !== null && from.session === session();
  const leave = (left: EndedIn, cause: AdvanceCause) => {
    from = left;
    listeners.forEach((listener) => {
      listener(cause);
    });
  };
  return {
    reported: () => {
      if (!ended()) return;
      leave(
        { session: session(), why: LEFT_BECAUSE.ended },
        ADVANCE_CAUSE.ended,
      );
    },
    pressedNext: (
      pressedIn: number,
      cause: AdvanceCause = ADVANCE_CAUSE.next,
    ) => {
      if (pressedIn !== session()) return;
      leave({ session: pressedIn, why: LEFT_BECAUSE.pressed }, cause);
    },
    subscribe: (listener: AdvanceListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stands: () => current() && (from?.why !== LEFT_BECAUSE.ended || ended()),
    gaveUp: () => current() && from?.why === LEFT_BECAUSE.unopened,
    unopened: (opened: number) => {
      from = { session: opened, why: LEFT_BECAUSE.unopened };
    },
    advanced: () => {
      from = null;
    },
    stopped: () => {
      stoppedIn = session();
      if (current()) from = null;
    },
    stoppedSince: (opened: number) => stoppedIn === opened,
  };
}

export type SongEnds = ReturnType<typeof songEnds>;

export interface AdvanceSteps {
  readonly ends: SongEnds;
  readonly begin: (id: number) => number;
  readonly load: (opened: number, id: number) => Promise<void>;
  readonly live: (opened: number) => boolean;
  readonly ready: () => boolean;
  readonly play: (headFrame?: number) => void;
  readonly prepare?: () => Promise<number>;
}

export async function startSong(
  steps: AdvanceSteps,
  id: number,
  start: StartMode = START.playing,
): Promise<AdvanceOutcome> {
  const opened = steps.begin(id);
  await steps.load(opened, id);
  if (!steps.live(opened)) return ADVANCE_OUTCOME.displaced;
  if (!steps.ready()) {
    steps.ends.unopened(opened);
    return ADVANCE_OUTCOME.unplayable;
  }
  let head: number | undefined;
  if (steps.prepare !== undefined) {
    head = await steps.prepare();
    if (!steps.live(opened)) return ADVANCE_OUTCOME.displaced;
  }
  steps.ends.advanced();
  if (start === START.paused) return ADVANCE_OUTCOME.paused;
  if (steps.ends.stoppedSince(opened)) return ADVANCE_OUTCOME.stopped;
  steps.play(head);
  return ADVANCE_OUTCOME.playing;
}

export function advanceSong(
  steps: AdvanceSteps,
  id: number,
  start: StartMode = START.playing,
): Promise<AdvanceOutcome> {
  if (!steps.ends.stands()) return Promise.resolve(ADVANCE_OUTCOME.displaced);
  return startSong(steps, id, start);
}
