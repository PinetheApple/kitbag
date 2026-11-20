import { turnClickOff } from '../stemPlayer/clickActions.ts';
import { plainStart } from '../stemPlayer/actions.ts';
import type { MixerSessionContext } from '../stemPlayer/mixerSession.ts';
import type { SongStart } from '../stemPlayer/songStart.ts';
import { songTransportShown } from '../stemPlayer/songTransport.ts';
import type { SongPlayerState } from './state.ts';

interface SongCardContext extends MixerSessionContext<SongPlayerState> {
  readonly close: () => void;
}

export function songCard(context: SongCardContext) {
  const { set, get, runtimeOf, session, close } = context;
  let shownIn: number | null = null;
  const shown = () => shownIn === session();
  const plain = plainStart(runtimeOf);
  const start: Pick<SongStart, 'play' | 'cancel'> = {
    ...plain,
    play: (head) => {
      shownIn = session();
      plain.play(head);
    },
  };
  return {
    start,
    // A Stop from an earlier song's card can land after the next song opened.
    stopped: () => {
      if (!shown()) return;
      turnClickOff(context);
      close();
    },
    named: (names: Pick<SongPlayerState, 'title' | 'artist'>) => {
      const { title, artist } = get();
      set(names);
      const renamed = names.title !== title || names.artist !== artist;
      if (!renamed || !shown()) return;
      const { commands, engine } = runtimeOf();
      commands.songTransportShow({
        ...songTransportShown(get()),
        playing: engine.playing(),
      });
    },
  };
}
