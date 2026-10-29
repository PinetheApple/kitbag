import { PlayPauseButton, stemPlayer, TransportKey } from '@kitbag/core-design';
import {
  SKIP_SECONDS,
  useStemPlayer,
  type LoopState,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: stemPlayer.transportGap,
  },
});

function loopLabel(loop: LoopState): string {
  if (loop.kind === 'off') return 'Loop: set the start here';
  if (loop.kind === 'armed') return 'Loop: set the end here';
  return 'Clear the loop';
}

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
  const back = useCallback(() => {
    skip(-SKIP_SECONDS);
  }, [skip]);
  const forward = useCallback(() => {
    skip(SKIP_SECONDS);
  }, [skip]);
  const onLoop = useCallback(() => {
    void markLoop();
  }, [markLoop]);
  const onClick = useCallback(() => {
    void toggleClick();
  }, [toggleClick]);
  return (
    <View style={styles.row}>
      <TransportKey
        size="dock"
        icon="repeat"
        selected={loop.kind !== 'off'}
        accessibilityLabel={loopLabel(loop)}
        onPress={onLoop}
      />
      <TransportKey
        size="dock"
        icon="skipBack"
        accessibilityLabel={`Back ${String(SKIP_SECONDS)} seconds`}
        onPress={back}
      />
      <PlayPauseButton
        size="dock"
        playing={playing}
        playLabel="Play"
        pauseLabel="Pause"
        onPress={togglePlay}
      />
      <TransportKey
        size="dock"
        icon="skipForward"
        accessibilityLabel={`Forward ${String(SKIP_SECONDS)} seconds`}
        onPress={forward}
      />
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
    </View>
  );
}
