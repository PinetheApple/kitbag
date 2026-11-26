import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Text as SvgText } from 'react-native-svg';

import { fontFace } from '../fontFaces.ts';
import { metronome } from '../metronomeRoles.ts';
import { READER_HIDDEN } from '../readerHiding.ts';
import { countSquareState, type CountSquareState } from './countSquareState.ts';
import { textRoles } from '../roles.ts';
import { TRANSPARENT } from '../styleConstants.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { TABULAR_FIGURES } from './DrawnFigures.tsx';

const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);

const FACE = textRoles.countSquare;
const MIDDLE = 'middle';
// Matches a Text with includeFontPadding off centred in the square: its baseline
// sits half the ascent-minus-descent below the centre, which "central" reproduces.
const CENTRAL = 'central';
const INK_STATES = [
  'now',
  'done',
  'upcoming',
] as const satisfies readonly CountSquareState[];

const useStyles = createThemedStyles(() => ({
  square: {
    borderRadius: metronome.countSquareRadius,
    borderWidth: metronome.countSquareBorder,
  },
}));

interface CountDigitProps {
  readonly digit: string;
  readonly ink: CountSquareState;
  readonly fill: string;
  readonly fontSize: number;
  readonly centre: number;
  readonly beat: number;
  readonly currentBeat: SharedValue<number>;
}

function CountDigit({
  digit,
  ink,
  fill,
  fontSize,
  centre,
  beat,
  currentBeat,
}: CountDigitProps) {
  const shown = useAnimatedProps(() => ({
    opacity: countSquareState(beat, currentBeat.value) === ink ? 1 : 0,
  }));
  return (
    <AnimatedSvgText
      transform={`translate(${String(centre)} ${String(centre)})`}
      textAnchor={MIDDLE}
      alignmentBaseline={CENTRAL}
      fill={fill}
      fontFamily={fontFace(FACE.family, FACE.weight)}
      fontSize={fontSize}
      fontFeatureSettings={TABULAR_FIGURES}
      animatedProps={shown}
    >
      {digit}
    </AnimatedSvgText>
  );
}

export interface CountSquareProps {
  readonly beat: number;
  readonly side: number;
  readonly currentBeat: SharedValue<number>;
}

export function CountSquare({ beat, side, currentBeat }: CountSquareProps) {
  const styles = useStyles();
  const { color } = useTheme();
  const box = useMemo(() => ({ width: side, height: side }), [side]);
  const fontSize = (FACE.size * side) / metronome.countSquare;
  const inks: Readonly<Record<CountSquareState, string>> = {
    now: color.bg,
    done: color.text3,
    upcoming: color.text2,
  };
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
  return (
    <Animated.View style={[styles.square, box, face]}>
      <Svg
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        {...READER_HIDDEN}
      >
        {INK_STATES.map((ink) => (
          <CountDigit
            key={ink}
            digit={String(beat + 1)}
            ink={ink}
            fill={inks[ink]}
            fontSize={fontSize}
            centre={side / 2 - metronome.countSquareBorder}
            beat={beat}
            currentBeat={currentBeat}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}
