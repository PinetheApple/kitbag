import { clamp } from '../metronome/config.ts';
import {
  loopBetween,
  movedEdge,
  snapToBeat,
  type HeldStart,
  type LoopSeconds,
} from '../stemPlayer/loop.ts';
import type { LoopSlice } from '../stemPlayer/loopActions.ts';
import type { StemPlayerActions } from '../stemPlayer/store.ts';
import { framesToSeconds } from '../stemPlayer/time.ts';

export interface HeldSlice extends LoopSlice {
  readonly startSec: number;
}

export type HeldTransportActions = Pick<
  StemPlayerActions,
  | 'seek'
  | 'scrub'
  | 'cancelScrub'
  | 'skip'
  | 'markLoop'
  | 'moveLoopEdge'
  | 'playheadSeconds'
>;

export function heldTransport(
  set: (change: Partial<HeldSlice>) => void,
  get: () => HeldSlice,
) {
  const lengthSec = () => {
    const { durationFrames, engineRate } = get();
    return framesToSeconds(durationFrames, engineRate);
  };
  const holdAt = (seconds: number) => {
    set({ startSec: clamp(seconds, 0, lengthSec()) });
  };
  const seek = (frame: number) => {
    holdAt(framesToSeconds(frame, get().engineRate));
  };
  const refuse = () => {
    const { loop } = get();
    set({
      loop: loop.kind === 'on' ? loop : { kind: 'off' },
      loopFailure: 'tooShort',
    });
  };
  const holdLoop = (bounds: LoopSeconds | null) => {
    const endSec = Math.min(bounds?.endSec ?? 0, lengthSec());
    if (bounds === null || endSec <= bounds.startSec) {
      refuse();
      return;
    }
    set({
      loop: { kind: 'on', startSec: bounds.startSec, endSec },
      loopFailure: null,
    });
  };
  const markLoop = () => {
    const { loop, beats, startSec } = get();
    if (loop.kind === 'on') set({ loop: { kind: 'off' }, loopFailure: null });
    else if (loop.kind === 'armed')
      holdLoop(loopBetween(loop.startSec, startSec, beats));
    else
      set({
        loop: { kind: 'armed', startSec: snapToBeat(startSec, beats) },
        loopFailure: null,
      });
    return Promise.resolve();
  };
  const actions: HeldTransportActions = {
    seek,
    scrub: seek,
    cancelScrub: () => undefined,
    skip: (seconds) => {
      holdAt(get().startSec + seconds);
    },
    markLoop,
    moveLoopEdge: (edge, seconds) => {
      const { loop, beats } = get();
      if (loop.kind === 'on')
        holdLoop(movedEdge(loop, edge, seconds, beats, lengthSec()));
      return Promise.resolve();
    },
    playheadSeconds: () => get().startSec,
  };
  return {
    actions,
    holdAt,
    holdLoop,
    held: (): HeldStart => {
      const { startSec, loop } = get();
      return {
        startSec,
        loop:
          loop.kind === 'on'
            ? { startSec: loop.startSec, endSec: loop.endSec }
            : null,
      };
    },
  };
}
