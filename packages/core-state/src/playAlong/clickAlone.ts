import type { StoreAccess } from '../configuredStore.ts';
import { chosenSession } from './libraryOffer.ts';
import type { LockedView } from './lockedView.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import type { PlayAlongSlot } from './slot.ts';

export interface ClickAloneState {
  readonly clickPlaying: boolean;
}

export interface ClickAloneActions {
  readonly startClick: () => void;
  readonly stopClick: () => void;
}

export function clickAlone(
  runtime: PlayAlongRuntime,
  { getState, setState }: StoreAccess<ClickAloneState & LockedView>,
  slot: PlayAlongSlot,
) {
  const stop = () => {
    if (!getState().clickPlaying) return;
    setState({ clickPlaying: false });
    slot.leave();
  };

  const start = () => {
    const { bpm, clickPlaying, lock } = getState();
    if (clickPlaying || lock !== undefined || bpm === undefined) return;
    if (chosenSession(runtime) !== undefined) return;
    slot.enter(stop);
    try {
      runtime.commands.setTempo(bpm);
      runtime.commands.metronomeStart(runtime.nowFrame());
    } catch (error) {
      slot.leave();
      throw error;
    }
    setState({ clickPlaying: true });
  };

  const watch = () => {
    const stopWatching = runtime.sessions().subscribe(() => {
      if (chosenSession(runtime) !== undefined) stop();
    });
    return () => {
      stopWatching();
      stop();
    };
  };

  return {
    start,
    stop,
    watch,
    retempo: (bpm: number) => {
      if (getState().clickPlaying) runtime.commands.setTempo(bpm);
    },
  };
}
