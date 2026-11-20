import type { MixerSession } from './mixerSession.ts';
import type { MixerRuntime } from './runtime.ts';
import {
  advanceSong,
  startSong,
  type AdvanceSteps,
  type SongEnds,
} from './songEnd.ts';
import type { StemPlayerActions, StemPlayerStore } from './store.ts';

interface StemSongAdvanceContext {
  readonly mixer: MixerSession;
  readonly ends: SongEnds;
  readonly get: () => Pick<
    StemPlayerStore,
    'status' | 'togglePlay' | 'countEndFrame'
  >;
  readonly set: (change: Pick<StemPlayerStore, 'advanceCountEnd'>) => void;
  readonly runtimeOf: () => MixerRuntime;
  readonly showLoading: (setId: number, advancedTo?: number | null) => void;
  readonly loadSession: (
    opened: number,
    setId: number,
    bars: number,
  ) => Promise<void>;
  readonly lastBars: () => number;
}

type StemSongAdvance = Pick<
  StemPlayerActions,
  'advanceTo' | 'takeOver' | 'handOver' | 'handToMetronome'
>;

export function stemSongAdvance({
  mixer,
  ends,
  get,
  set,
  runtimeOf,
  showLoading,
  loadSession,
  lastBars,
}: StemSongAdvanceContext): StemSongAdvance {
  const steps = (
    begin: (setId: number) => number,
    bars: () => number,
  ): AdvanceSteps => ({
    ends,
    begin,
    load: (opened, id) => loadSession(opened, id, bars()),
    live: mixer.live,
    ready: () => get().status === 'ready',
    play: () => {
      get().togglePlay();
      set({ advanceCountEnd: get().countEndFrame });
    },
  });
  return {
    advanceTo: (setId) =>
      advanceSong(
        steps((id) => {
          const opened = mixer.advance();
          showLoading(id, id);
          return opened;
        }, lastBars),
        setId,
      ),
    takeOver: (setId, bars) =>
      startSong(
        steps(
          (id) => {
            const opened = mixer.begin();
            showLoading(id);
            return opened;
          },
          () => bars,
        ),
        setId,
      ),
    handOver: mixer.handOver,
    handToMetronome: () => {
      runtimeOf().sharedMetronome.showStopped();
      mixer.close();
    },
  };
}
