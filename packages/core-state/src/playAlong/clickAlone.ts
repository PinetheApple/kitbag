import type { StoreAccess } from '../configuredStore.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import type { PlayAlongSlot } from './slot.ts';

export interface ClickAloneState {
  readonly clickPlaying: boolean;
}

export interface ClickAloneActions {
  readonly startClick: () => void;
  readonly stopClick: () => void;
}

type ClickAccess = StoreAccess<
  ClickAloneState & {
    readonly bpm: number | undefined;
    readonly lock: object | undefined;
  }
>;

export function clickAlone(
  runtime: PlayAlongRuntime,
  { getState, setState }: ClickAccess,
  slot: PlayAlongSlot,
  hasSong: () => boolean,
) {
  const { commands } = runtime;
  return {
    start: () => {
      const { bpm, clickPlaying, lock } = getState();
      if (clickPlaying || lock !== undefined || bpm === undefined) return;
      if (hasSong()) return;
      slot.enter();
      commands.setTempo(bpm);
      commands.metronomeStart(runtime.nowFrame());
      setState({ clickPlaying: true });
    },
    stop: () => {
      if (!getState().clickPlaying) return;
      setState({ clickPlaying: false });
      slot.leave();
    },
    handOver: () => {
      if (!getState().clickPlaying) return;
      commands.metronomeStop();
      setState({ clickPlaying: false });
    },
    retempo: (bpm: number) => {
      if (getState().clickPlaying) commands.setTempo(bpm);
    },
  };
}
