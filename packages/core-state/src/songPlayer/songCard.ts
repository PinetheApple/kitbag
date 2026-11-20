import { turnClickOff } from '../stemPlayer/clickActions.ts';
import type { MixerSessionContext } from '../stemPlayer/mixerSession.ts';
import type { SongStart } from '../stemPlayer/songStart.ts';
import {
  songTransportShown,
  type SongCardOwner,
} from '../stemPlayer/songTransport.ts';
import type { SongPlayerState } from './state.ts';

interface SongCardContext extends MixerSessionContext<SongPlayerState> {
  readonly close: () => void;
  readonly cardStopped: () => void;
  readonly start: Pick<SongStart, 'play' | 'cancel'>;
  readonly card: () => SongCardOwner;
}

export function songCard(context: SongCardContext) {
  const { set, get, runtimeOf, session, close, cardStopped, start, card } =
    context;
  let shownIn: number | null = null;
  const shown = () => shownIn === session();
  const shownStart: Pick<SongStart, 'play' | 'cancel'> = {
    cancel: start.cancel,
    play: (head) => {
      shownIn = session();
      start.play(head);
    },
  };
  return {
    start: shownStart,
    // A Stop from an earlier song's card can land after the next song opened.
    stopped: () => {
      if (!shown()) return;
      turnClickOff(context);
      close();
      cardStopped();
    },
    named: (names: Pick<SongPlayerState, 'title' | 'artist'>) => {
      const { title, artist } = get();
      set(names);
      const renamed = names.title !== title || names.artist !== artist;
      if (!renamed || !shown()) return;
      const { commands, engine } = runtimeOf();
      commands.songTransportShow({
        ...songTransportShown(get(), card()),
        playing: engine.playing(),
      });
    },
  };
}
