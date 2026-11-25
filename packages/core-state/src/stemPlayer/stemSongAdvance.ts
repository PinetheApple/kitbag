import type { HeldStart } from './loop.ts';
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
    'status' | 'togglePlay' | 'playFrom' | 'countEndFrame'
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
  readonly applyHeld: (held: HeldStart) => Promise<number>;
}

type StemSongAdvance = Pick<
  StemPlayerActions,
  'advanceTo' | 'playNow' | 'takeOver' | 'handOver' | 'handToMetronome'
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
  applyHeld,
}: StemSongAdvanceContext): StemSongAdvance {
  const steps = (
    begin: (setId: number) => number,
    bars: () => number,
    held?: HeldStart,
  ): AdvanceSteps => ({
    ends,
    begin,
    load: (opened, id) => loadSession(opened, id, bars()),
    live: mixer.live,
    ready: () => get().status === 'ready',
    play: (head) => {
      if (head === undefined) get().togglePlay();
      else get().playFrom(head);
      set({ advanceCountEnd: get().countEndFrame });
    },
    ...(held === undefined ? {} : { prepare: () => applyHeld(held) }),
  });
  const advancing = steps((id) => {
    const opened = mixer.advance();
    showLoading(id, id);
    return opened;
  }, lastBars);
  return {
    advanceTo: (setId) => advanceSong(advancing, setId),
    playNow: (setId) => startSong(advancing, setId),
    takeOver: (setId, bars, held) =>
      startSong(
        steps(
          (id) => {
            const opened = mixer.begin();
            showLoading(id);
            return opened;
          },
          () => bars,
          held,
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
