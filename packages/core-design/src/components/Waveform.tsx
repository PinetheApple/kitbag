import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { clampUnit } from '../clampUnit.ts';
import { radius, space, waveMinBarFraction } from '../roles.ts';
import { useTheme } from '../ThemeProvider.tsx';
import { waveBarHeights, waveBarsPath } from '../waveform.ts';
import { WaveLayers } from './ProgressSvg.tsx';

export interface WaveformProps {
  readonly envelope: readonly number[] | null;
  readonly bars: number;
  readonly height: number;
  readonly progress?: SharedValue<number>;
  readonly extent?: number;
}

const styles = StyleSheet.create({
  lane: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
});

export function Waveform({
  envelope,
  bars,
  height,
  progress,
  extent = 1,
}: WaveformProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const barsWidth = width * clampUnit(extent);
  const path = useMemo(
    () =>
      waveBarsPath(waveBarHeights(envelope, bars, waveMinBarFraction), {
        width: barsWidth,
        height,
        gap: space.waveBarGap,
        radius: radius.waveBar,
      }),
    [envelope, bars, barsWidth, height],
  );
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  return (
    <View style={[styles.lane, { height }]} onLayout={onLayout}>
      <WaveLayers
        path={path}
        width={width}
        color={theme.color.wave}
        playedColor={theme.color.waveHot}
        progress={progress}
      />
    </View>
  );
}
