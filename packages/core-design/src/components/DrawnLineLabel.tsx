import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import { fontFace } from '../fontFaces.ts';
import { READER_HIDDEN } from '../readerHiding.ts';
import { textRoles } from '../roles.ts';
import { grownTextScale } from '../textScale.ts';
import { TABULAR_FIGURES, type PlainRoleName } from './drawnText.ts';

export interface DrawnLineLabelProps {
  readonly text: string;
  readonly role: PlainRoleName;
  readonly lineHeight: number;
  readonly width: number;
  readonly color: string;
}

const ANCHOR_AT_CENTRE = 'middle';
// RN centres a line's ascent-to-descent box in its line height; "central" sets the
// svg baseline the same way about the line's middle.
const BASELINE_OF_CENTRED_LINE = 'central';

export function DrawnLineLabel({
  text,
  role,
  lineHeight,
  width,
  color,
}: DrawnLineLabelProps) {
  const { fontScale } = useWindowDimensions();
  const face = textRoles[role];
  const box = useMemo(
    () => ({ width, height: lineHeight * grownTextScale(fontScale) }),
    [width, lineHeight, fontScale],
  );
  const centre = `translate(${String(width / 2)} ${String((lineHeight * fontScale) / 2)})`;
  return (
    <View style={box} pointerEvents="none" {...READER_HIDDEN}>
      {text.trim() === '' ? null : (
        <Svg style={StyleSheet.absoluteFill}>
          <SvgText
            transform={centre}
            textAnchor={ANCHOR_AT_CENTRE}
            alignmentBaseline={BASELINE_OF_CENTRED_LINE}
            fill={color}
            fontFamily={fontFace(face.family, face.weight)}
            fontSize={face.size * fontScale}
            {...('tabular' in face
              ? { fontFeatureSettings: TABULAR_FIGURES }
              : null)}
          >
            {text}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}
