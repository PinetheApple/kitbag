import {
  BeatDotGrid,
  createThemedStyles,
  MAX_DOTS_PER_LINE,
  opacity,
  PickerChips,
  space,
} from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';
import {
  getPlayAlongStore,
  layoutBeatLeds,
  ledStateFor,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { cycledAccents } from '../logic/patternEdit.ts';
import { usePlayAlong } from './playAlongHooks.ts';
import { useClickFrame } from './useClickFrame.ts';

const DOT_DENSITY = 'roomy';

const useStyles = createThemedStyles(() => ({
  card: { gap: space.sectionGap },
  muted: { opacity: opacity.muted },
}));

function cycleBeat(beat: number): void {
  const playAlong = getPlayAlongStore().getState();
  playAlong.setAccents(cycledAccents(playAlong.pattern.accents, beat));
}

export interface PatternCardProps {
  readonly following: boolean;
  readonly muted: boolean;
  readonly onOpenMeter: () => void;
  readonly onOpenSubdivision: () => void;
}

export function PatternCard({
  following,
  muted,
  onOpenMeter,
  onOpenSubdivision,
}: PatternCardProps) {
  const styles = useStyles();
  const { beatsPerBar, denominator, subdivision, accents } = usePlayAlong(
    (s) => s.pattern,
  );
  const frame = useClickFrame(following);
  const [width, setWidth] = useState(0);
  const lines = useMemo(
    () => layoutBeatLeds(beatsPerBar, MAX_DOTS_PER_LINE),
    [beatsPerBar],
  );
  const states = useMemo(
    () =>
      Array.from({ length: beatsPerBar }, (_unused, beat) =>
        ledStateFor(accents[beat] ?? KB_ACCENT.KB_ACCENT_NORMAL),
      ),
    [accents, beatsPerBar],
  );
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  return (
    <View style={styles.card}>
      <PickerChips
        beatsPerBar={beatsPerBar}
        denominator={denominator}
        subdivision={subdivision}
        onOpenMeter={onOpenMeter}
        onOpenSubdivision={onOpenSubdivision}
      />
      <View style={muted ? styles.muted : null} onLayout={handleLayout}>
        <BeatDotGrid
          lines={lines}
          states={states}
          subdivision={subdivision}
          width={width}
          density={DOT_DENSITY}
          frame={frame}
          onCycle={cycleBeat}
        />
      </View>
    </View>
  );
}
