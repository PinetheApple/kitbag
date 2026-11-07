import { PlayerTransport, TransportKey } from '@kitbag/core-design';
import { loopKeyLabel, SKIP_SECONDS, useStemPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export function StemTransport({
  playing,
}: {
  readonly playing: SharedValue<number>;
}) {
  const loop = useStemPlayer((s) => s.loop);
  const click = useStemPlayer((s) => s.click);
  const hasGrid = useStemPlayer((s) => s.beats.length > 0);
  const togglePlay = useStemPlayer((s) => s.togglePlay);
  const skip = useStemPlayer((s) => s.skip);
  const markLoop = useStemPlayer((s) => s.markLoop);
  const toggleClick = useStemPlayer((s) => s.toggleClick);
  const onLoop = useCallback(() => {
    void markLoop();
  }, [markLoop]);
  const onClick = useCallback(() => {
    void toggleClick();
  }, [toggleClick]);
  return (
    <PlayerTransport
      playing={playing}
      loopActive={loop.kind !== 'off'}
      loopLabel={loopKeyLabel(loop)}
      skipSeconds={SKIP_SECONDS}
      onLoop={onLoop}
      onSkip={skip}
      onTogglePlay={togglePlay}
      extraKey={
        <TransportKey
          size="dock"
          icon="metronome"
          selected={click}
          disabled={!hasGrid}
          accessibilityLabel={
            click ? 'Stop the click' : 'Click along on the song grid'
          }
          onPress={onClick}
        />
      }
    />
  );
}
