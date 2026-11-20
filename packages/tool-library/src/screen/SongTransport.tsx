import {
  PlayerDock,
  PlayerTransport,
  TransportKey,
  type PlayerFrame,
} from '@kitbag/core-design';
import {
  isUnitySpeed,
  loopKeyLabel,
  SKIP_SECONDS,
  speedKeyCopy,
  speedPercentText,
  useSongPlayer,
} from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { LOOP_KEY_TEXT } from '../logic/viewText.ts';
import { SongSpeedSheet } from './SongSpeedSheet.tsx';

export interface SongTransportProps {
  readonly playing: PlayerFrame['playing'];
  readonly bottomInset: number;
}

export function SongTransport({ playing, bottomInset }: SongTransportProps) {
  const loop = useSongPlayer((s) => s.loop);
  const speed = useSongPlayer((s) => s.speed);
  const togglePlay = useSongPlayer((s) => s.togglePlay);
  const skip = useSongPlayer((s) => s.skip);
  const markLoop = useSongPlayer((s) => s.markLoop);
  const [speedOpen, setSpeedOpen] = useState(false);
  const onLoop = useCallback(() => {
    void markLoop();
  }, [markLoop]);
  const openSpeed = useCallback(() => {
    setSpeedOpen(true);
  }, []);
  const closeSpeed = useCallback(() => {
    setSpeedOpen(false);
  }, []);
  const speedText = speedPercentText(speed);
  return (
    <>
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
              text={speedText}
              selected={!isUnitySpeed(speed)}
              accessibilityLabel={`${speedKeyCopy.speed} ${speedText}`}
              onPress={openSpeed}
            />
          }
        />
      </PlayerDock>
      <SongSpeedSheet
        visible={speedOpen}
        bottomInset={bottomInset}
        onClose={closeSpeed}
      />
    </>
  );
}
