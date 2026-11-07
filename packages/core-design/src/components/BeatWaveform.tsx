import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { beatTicks, tickPath } from '../beatTicks.ts';
import { songPlayer } from '../stemPlayerRoles.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { Waveform } from './Waveform.tsx';

const useStyles = createThemedStyles(() => ({
  lane: { alignSelf: 'stretch', height: songPlayer.cardWave },
  ticks: { position: 'absolute', left: 0, top: 0 },
}));

export interface BeatWaveformProps {
  readonly envelope: readonly number[] | null;
  readonly progress: SharedValue<number>;
  readonly beats: readonly number[];
  readonly downbeats: readonly number[];
  readonly durationSec: number;
  /** x is relative to this waveform; width is this waveform's own. */
  readonly onTap: (x: number, width: number) => void;
}

export function BeatWaveform({
  envelope,
  progress,
  beats,
  downbeats,
  durationSec,
  onTap,
}: BeatWaveformProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  const ticks = useMemo(
    () =>
      beatTicks(
        beats,
        downbeats,
        durationSec,
        width,
        songPlayer.beatTickColumn,
      ),
    [beats, downbeats, durationSec, width],
  );
  const shortPath = useMemo(
    () =>
      tickPath(
        ticks.filter((tick) => !tick.tall),
        songPlayer.cardWave,
        songPlayer.beatTickShort,
      ),
    [ticks],
  );
  const tallPath = useMemo(
    () =>
      tickPath(
        ticks.filter((tick) => tick.tall),
        songPlayer.cardWave,
        songPlayer.beatTickTall,
      ),
    [ticks],
  );
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((event, success) => {
          if (success) onTap(event.x, width);
        }),
    [onTap, width],
  );
  return (
    <GestureDetector gesture={tap}>
      <View style={styles.lane} onLayout={onLayout}>
        <Waveform
          envelope={envelope}
          bars={songPlayer.waveBars}
          height={songPlayer.cardWave}
          progress={progress}
        />
        {ticks.length === 0 ? null : (
          <Svg
            pointerEvents="none"
            style={styles.ticks}
            width={width}
            height={songPlayer.cardWave}
          >
            <Path
              d={shortPath}
              stroke={theme.color.text3}
              strokeWidth={songPlayer.beatTick}
            />
            <Path
              d={tallPath}
              stroke={theme.color.text}
              strokeWidth={songPlayer.beatTick}
            />
          </Svg>
        )}
      </View>
    </GestureDetector>
  );
}
