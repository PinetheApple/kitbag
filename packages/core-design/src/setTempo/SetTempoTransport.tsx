import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { PlayPauseButton } from '../components/PrimaryPlayButton.tsx';
import {
  ScrubRow,
  type PlayerFrame,
  type ScrubRowProps,
} from '../components/ScrubRow.tsx';
import { space } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const PLAY = 'Play';
const PAUSE = 'Pause';

export type SetTempoPlayhead = PlayerFrame & {
  readonly songSec: SharedValue<number>;
};

export interface SetTempoTransportProps {
  readonly onTogglePlay: () => void;
  readonly scrub: Omit<ScrubRowProps, 'frame'>;
}

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.rowGap },
  scrub: { flex: 1, minWidth: 0 },
}));

export function SetTempoTransport({
  playhead,
  onTogglePlay,
  scrub,
}: SetTempoTransportProps & { readonly playhead: SetTempoPlayhead }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <PlayPauseButton
        size="small"
        playing={playhead.playing}
        playLabel={PLAY}
        pauseLabel={PAUSE}
        onPress={onTogglePlay}
      />
      <View style={styles.scrub}>
        <ScrubRow frame={playhead} {...scrub} />
      </View>
    </View>
  );
}
