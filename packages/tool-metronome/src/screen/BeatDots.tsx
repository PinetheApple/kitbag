import {
  BeatDotGrid,
  beatDotGeometry,
  MAX_DOTS_PER_LINE,
  useBeatDotStyles,
  widestLineWidth,
  type ScreenDensity,
} from '@kitbag/core-design';
import { KB_ACCENT, type KB_ACCENT as Accent } from '@kitbag/core-native';
import { layoutBeatLeds, ledStateFor } from '@kitbag/core-state';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { CountInSquares } from './CountInSquares.tsx';
import { PolyDots } from './PolyDots.tsx';

export interface BeatDotsFrame {
  readonly barPhase: SharedValue<number>;
  readonly currentBeat: SharedValue<number>;
  readonly currentPolyBeat: SharedValue<number>;
  readonly polyDownbeatPhase: SharedValue<number>;
  readonly barMuted: SharedValue<number>;
  readonly countingIn: SharedValue<number>;
}

interface BeatDotsProps {
  readonly beatCount: number;
  readonly subdivision: number;
  readonly polyBeats: number | null;
  readonly polyAgainst: number;
  readonly accents: readonly Accent[];
  readonly width: number;
  readonly density: ScreenDensity;
  readonly frame: BeatDotsFrame;
  readonly onCycle: (beat: number) => void;
}

export function BeatDots({
  beatCount,
  subdivision,
  polyBeats,
  polyAgainst,
  accents,
  width,
  density,
  frame,
  onCycle,
}: BeatDotsProps) {
  const lines = useMemo(
    () => layoutBeatLeds(beatCount, MAX_DOTS_PER_LINE),
    [beatCount],
  );
  const states = useMemo(
    () =>
      Array.from({ length: beatCount }, (_unused, beat) =>
        ledStateFor(accents[beat] ?? KB_ACCENT.KB_ACCENT_NORMAL),
      ),
    [accents, beatCount],
  );
  const { metrics, dotSize, lineGap } = beatDotGeometry(lines, width, density);
  const { countingIn, currentBeat } = frame;
  const dotsShown = useAnimatedStyle(() => {
    const shown = countingIn.value === 0;
    return { opacity: shown ? 1 : 0, pointerEvents: shown ? 'auto' : 'none' };
  });
  return (
    <View>
      <BeatDotGrid
        lines={lines}
        states={states}
        subdivision={subdivision}
        width={width}
        density={density}
        frame={frame}
        onCycle={onCycle}
        style={dotsShown}
      >
        {polyBeats === null ? null : (
          <PolyDots
            polyBeats={polyBeats}
            polyAgainst={polyAgainst}
            beatsPerBar={beatCount}
            lineWidth={widestLineWidth(lines, dotSize, metrics)}
            areaWidth={width}
            dotSize={dotSize}
            frame={frame}
          />
        )}
      </BeatDotGrid>
      <CountInSquares
        lines={lines}
        dotSize={dotSize}
        lineGap={lineGap}
        currentBeat={currentBeat}
        countingIn={countingIn}
      />
    </View>
  );
}

export function BeatLegend() {
  const styles = useBeatDotStyles();
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, styles.swatchAccent]} />
        <Text style={styles.legendLabel}>accent</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, styles.swatchNormal]} />
        <Text style={styles.legendLabel}>normal</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, styles.swatchMuted]} />
        <Text style={styles.legendLabel}>muted</Text>
      </View>
    </View>
  );
}
