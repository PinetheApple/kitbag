import { PlayerTransport, TransportKey } from '@kitbag/core-design';
import {
  clickKeyLabel,
  loopKeyLabel,
  SKIP_SECONDS,
  useLiveStemPlayer,
  useStemPlayer,
  useStemViewing,
  useViewPlayLabel,
} from '@kitbag/core-state';
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
  const toggleClick = useLiveStemPlayer((s) => s.toggleClick);
  const viewing = useStemViewing();
  const title = useStemPlayer((s) => s.title);
  const playLabel = useViewPlayLabel(title, viewing);
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
      {...(playLabel === undefined ? {} : { playLabel })}
      extraKey={
        <TransportKey
          size="dock"
          icon="metronome"
          selected={click}
          disabled={!hasGrid || viewing}
          accessibilityLabel={clickKeyLabel(click)}
          onPress={onClick}
        />
      }
    />
  );
}
