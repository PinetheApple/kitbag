import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type TextStyle,
} from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import { fontFace } from '../fontFaces.ts';
import { readerHiding } from '../readerHiding.ts';
import { textStyle } from '../textStyle.ts';
import type { TypeRole } from '../tokens.ts';

export interface DrawnFiguresProps {
  readonly text: string;
  readonly role: TypeRole;
  readonly color: string;
}

const TABULAR_FIGURES = "'tnum'";
const TABULAR_VARIANT: TextStyle['fontVariant'] = ['tabular-nums'];
const ANY_DIGIT = /\d/g;
const SAME_WIDTH_DIGIT = '0';
// Android lays a Text's first line out from the font's top metric; "top" puts the
// svg baseline at the same depth, so the drawing sits where the Text would.
const TEXT_LINE_TOP = 'top';
const READER_HIDDEN = { ...readerHiding(true), accessible: false };

const styles = StyleSheet.create({
  ghost: { opacity: 0 },
});

export function DrawnFigures({ text, role, color }: DrawnFiguresProps) {
  const { fontScale } = useWindowDimensions();
  const ghost = useMemo(
    () => [textStyle(role), { fontVariant: TABULAR_VARIANT }, styles.ghost],
    [role],
  );
  return (
    <View pointerEvents="none" {...READER_HIDDEN}>
      <Text style={ghost}>{text.replace(ANY_DIGIT, SAME_WIDTH_DIGIT)}</Text>
      <Svg style={StyleSheet.absoluteFill}>
        <SvgText
          fill={color}
          fontFamily={fontFace(role.family, role.weight)}
          fontSize={role.size * fontScale}
          fontFeatureSettings={TABULAR_FIGURES}
          alignmentBaseline={TEXT_LINE_TOP}
        >
          {text}
        </SvgText>
      </Svg>
    </View>
  );
}
