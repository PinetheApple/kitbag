import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import { fontFace } from '../fontFaces.ts';
import { READER_HIDDEN } from '../readerHiding.ts';
import { textRoles, type TextRoleName } from '../roles.ts';
import { useTheme } from '../ThemeProvider.tsx';
import type { ColorToken } from '../tokens.ts';
import { GhostText } from './GhostText.tsx';

type Roles = typeof textRoles;
export type PlainRoleName = {
  [Name in TextRoleName]: Roles[Name] extends
    { readonly tracking: number } | { readonly uppercase: true }
    ? never
    : Name;
}[TextRoleName];

export interface DrawnFiguresProps {
  readonly text: string;
  readonly role: PlainRoleName;
  readonly color?: ColorToken;
}

export const TABULAR_FIGURES = "'tnum'";
const ANY_DIGIT = /\d/g;
const SAME_WIDTH_DIGIT = '0';
// Android lays a Text's first line out from the font's top metric; "top" puts the
// svg baseline at the same depth, so the drawing sits where the Text would.
export const TEXT_LINE_TOP = 'top';

export function DrawnFigures({
  text,
  role,
  color = 'text',
}: DrawnFiguresProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const face = textRoles[role];
  return (
    <View pointerEvents="none" {...READER_HIDDEN}>
      <GhostText role={role} text={text.replace(ANY_DIGIT, SAME_WIDTH_DIGIT)} />
      <Svg style={StyleSheet.absoluteFill}>
        <SvgText
          fill={theme.color[color]}
          fontFamily={fontFace(face.family, face.weight)}
          fontSize={face.size * fontScale}
          fontFeatureSettings={TABULAR_FIGURES}
          alignmentBaseline={TEXT_LINE_TOP}
        >
          {text}
        </SvgText>
      </Svg>
    </View>
  );
}
