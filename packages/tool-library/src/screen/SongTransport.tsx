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
  useSongViewing,
  useViewPlayLabel,
} from '@kitbag/core-state';
import { useCallback, useState, type ReactNode } from 'react';

import { SongSpeedSheet } from './SongSpeedSheet.tsx';

export interface SongTransportProps {
  readonly playing: PlayerFrame['playing'];
  readonly bottomInset: number;
  readonly sheetInset: number;
  readonly upNext?: ReactNode;
}

export function SongTransport({
  playing,
  bottomInset,
  sheetInset,
  upNext,
}: SongTransportProps) {
  const loop = useSongPlayer((s) => s.loop);
  const speed = useSongPlayer((s) => s.speed);
  const togglePlay = useSongPlayer((s) => s.togglePlay);
  const skip = useSongPlayer((s) => s.skip);
  const markLoop = useSongPlayer((s) => s.markLoop);
  const title = useSongPlayer((s) => s.title);
  const playLabel = useViewPlayLabel(title, useSongViewing());
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
        {upNext}
        <PlayerTransport
          playing={playing}
          loopActive={loop.kind !== 'off'}
          loopLabel={loopKeyLabel(loop)}
          skipSeconds={SKIP_SECONDS}
          onLoop={onLoop}
          onSkip={skip}
          onTogglePlay={togglePlay}
          {...(playLabel === undefined ? {} : { playLabel })}
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
        bottomInset={sheetInset}
        onClose={closeSpeed}
      />
    </>
  );
}
