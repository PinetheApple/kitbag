import { useMemo } from 'react';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { metronome } from '../metronomeRoles.ts';
import { countSquareState } from './countSquareState.ts';
import { textRoles } from '../roles.ts';
import { TRANSPARENT, UNSCALED_TEXT } from '../styleConstants.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';

const useStyles = createThemedStyles(() => ({
  square: {
    borderRadius: metronome.countSquareRadius,
    borderWidth: metronome.countSquareBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    ...textStyle(textRoles.countSquare),
    includeFontPadding: false,
  },
}));

export interface CountSquareProps {
  readonly beat: number;
  readonly side: number;
  readonly currentBeat: SharedValue<number>;
}

export function CountSquare({ beat, side, currentBeat }: CountSquareProps) {
  const styles = useStyles();
  const { color } = useTheme();
  const box = useMemo(() => ({ width: side, height: side }), [side]);
  const number = useMemo(
    () => ({
      fontSize: (textRoles.countSquare.size * side) / metronome.countSquare,
    }),
    [side],
  );
  const face = useAnimatedStyle(() => {
    const state = countSquareState(beat, currentBeat.value);
    if (state === 'now') {
      return { backgroundColor: color.text, borderColor: color.text };
    }
    if (state === 'done') {
      return { backgroundColor: color.surface3, borderColor: color.surface3 };
    }
    return { backgroundColor: TRANSPARENT, borderColor: color.decor };
  });
  const ink = useAnimatedStyle(() => {
    const state = countSquareState(beat, currentBeat.value);
    if (state === 'now') return { color: color.bg };
    return { color: state === 'done' ? color.text3 : color.text2 };
  });
  return (
    <Animated.View style={[styles.square, box, face]}>
      <Animated.Text
        maxFontSizeMultiplier={UNSCALED_TEXT}
        style={[styles.number, number, ink]}
      >
        {String(beat + 1)}
      </Animated.Text>
    </Animated.View>
  );
}
