import {
  PlayerDock,
  PlayerTransport,
  snackbar,
  Snackbar,
  TransportKey,
  type PlayerFrame,
} from '@kitbag/core-design';
import { loopKeyLabel, SKIP_SECONDS, useSongPlayer } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import {
  LOOP_KEY_TEXT,
  SPEED_KEY_LABEL,
  SPEED_KEY_TEXT,
  SPEED_NOTE,
} from '../logic/viewText.ts';
import { NoteAnchor } from './NoteAnchor.tsx';

export interface SongTransportProps {
  readonly playing: PlayerFrame['playing'];
  readonly bottomInset: number;
}

export function SongTransport({ playing, bottomInset }: SongTransportProps) {
  const loop = useSongPlayer((s) => s.loop);
  const togglePlay = useSongPlayer((s) => s.togglePlay);
  const skip = useSongPlayer((s) => s.skip);
  const markLoop = useSongPlayer((s) => s.markLoop);
  const [speedNote, setSpeedNote] = useState(false);
  const onLoop = useCallback(() => {
    void markLoop();
  }, [markLoop]);
  const showSpeedNote = useCallback(() => {
    setSpeedNote(true);
  }, []);
  const hideSpeedNote = useCallback(() => {
    setSpeedNote(false);
  }, []);
  return (
    <>
      <NoteAnchor>
        {speedNote ? (
          <Snackbar
            message={SPEED_NOTE}
            bottom={snackbar.aboveDock}
            onTimeout={hideSpeedNote}
          />
        ) : null}
      </NoteAnchor>
      <PlayerDock bottomInset={bottomInset}>
        <PlayerTransport
          playing={playing}
          loopActive={loop.kind !== 'off'}
          loopLabel={loopKeyLabel(loop)}
          loopText={LOOP_KEY_TEXT}
          skipSeconds={SKIP_SECONDS}
          onLoop={onLoop}
          onSkip={skip}
          onTogglePlay={togglePlay}
          extraKey={
            <TransportKey
              size="dock"
              text={SPEED_KEY_TEXT}
              muted
              accessibilityLabel={SPEED_KEY_LABEL}
              onPress={showSpeedNote}
            />
          }
        />
      </PlayerDock>
    </>
  );
}
