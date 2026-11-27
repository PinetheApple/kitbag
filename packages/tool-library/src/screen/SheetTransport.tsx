import {
  createThemedStyles,
  PlayPauseButton,
  ScrubRow,
  space,
} from '@kitbag/core-design';
import { useLoopScrub, useSongPlayer } from '@kitbag/core-state';
import { View } from 'react-native';

import type { SongPlayhead } from './playhead.ts';

const PLAY = 'Play';
const PAUSE = 'Pause';

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.rowGap },
  scrub: { flex: 1, minWidth: 0 },
}));

export function SheetTransport({
  playhead,
}: {
  readonly playhead: SongPlayhead;
}) {
  const styles = useStyles();
  const togglePlay = useSongPlayer((s) => s.togglePlay);
  const scrub = useLoopScrub(useSongPlayer);
  return (
    <View style={styles.row}>
      <PlayPauseButton
        size="small"
        playing={playhead.playing}
        playLabel={PLAY}
        pauseLabel={PAUSE}
        onPress={togglePlay}
      />
      <View style={styles.scrub}>
        <ScrubRow frame={playhead} {...scrub} />
      </View>
    </View>
  );
}
