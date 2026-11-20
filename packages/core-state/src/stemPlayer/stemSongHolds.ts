import { ATTACHABLE, type MixerSession } from './mixerSession.ts';
import type { MixerRuntime } from './runtime.ts';
import type { SongEnds } from './songEnd.ts';
import type { SongStart } from './songStart.ts';
import type { StemPlayerStore } from './store.ts';

interface StemSongHoldContext {
  readonly mixer: MixerSession;
  readonly get: () => Pick<StemPlayerStore, 'status' | 'setId' | 'leaveRetime'>;
  readonly ends: SongEnds;
  readonly runtimeOf: () => MixerRuntime;
  readonly start: Pick<SongStart, 'counting'>;
}

export function stemSongHolds({
  mixer,
  get,
  ends,
  runtimeOf,
  start,
}: StemSongHoldContext) {
  const sounding = () => runtimeOf().engine.playing() || start.counting();
  // A card Stop under a holding screen still ends the song when the screen goes.
  mixer.onLastRelease({
    keepsSong: () =>
      get().status === 'ready' &&
      (!ends.stoppedSince(mixer.current()) || sounding()),
    then: () => {
      get().leaveRetime();
    },
  });
  return {
    onCardStop: (stopped: () => void) => {
      mixer.onSongStopped(() => {
        stopped();
        ends.stopped();
        mixer.cardStopped();
        if (!mixer.hasHolders()) mixer.close();
      });
    },
    gaveUp: () => {
      if (!ends.gaveUp()) return;
      if (mixer.hasHolders()) runtimeOf().commands.songTransportHide();
      else mixer.close();
    },
    joins: (setId: number) => {
      const { setId: open, status } = get();
      return open === setId && ATTACHABLE.has(status);
    },
  };
}
