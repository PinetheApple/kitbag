import {
  BeatDotGrid,
  createThemedStyles,
  MAX_DOTS_PER_LINE,
  opacity,
  PickerChips,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import {
  getPlayAlongStore,
  layoutBeatLeds,
  ledStatesFor,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import { cycledAccents } from '../logic/patternEdit.ts';
import { recallLine } from '../logic/saveForSong.ts';
import { usePlayAlong } from './playAlongHooks.ts';
import { useClickFrame } from './useClickFrame.ts';

const DOT_DENSITY = 'roomy';

const useStyles = createThemedStyles((theme) => ({
  card: { gap: space.sectionGap },
  muted: { opacity: opacity.muted },
  recall: {
    ...textStyle(textRoles.fieldLabel),
    textAlign: 'center',
    color: theme.color.text2,
  },
}));

function RecallLine({ following }: { readonly following: boolean }) {
  const styles = useStyles();
  const pattern = usePlayAlong((s) => s.pattern);
  const hasSaved = usePlayAlong((s) => s.hasSavedPreset) && !following;
  if (!hasSaved) return null;
  return <Text style={styles.recall}>{recallLine(pattern)}</Text>;
}

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
    () => ledStatesFor(accents, beatsPerBar),
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
      <RecallLine following={following} />
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
