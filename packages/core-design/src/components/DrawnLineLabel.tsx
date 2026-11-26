import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import { READER_HIDDEN } from '../readerHiding.ts';
import { textRoles } from '../roles.ts';
import {
  ANCHOR_AT_CENTRE,
  BASELINE_AT_CENTRE,
  drawnFont,
  type PlainRoleName,
} from './drawnText.ts';

export interface LabelLineSpacerProps {
  readonly lineHeight: number;
  readonly width: number;
}

export interface DrawnLineLabelProps extends LabelLineSpacerProps {
  readonly text: string;
  readonly role: PlainRoleName;
  readonly color: string;
}

const TABULAR_ROLES_ONLY = { tabularOnlyForTabularRoles: true } as const;

function useLabelLine(lineHeight: number, width: number) {
  const { fontScale } = useWindowDimensions();
  const line = lineHeight * fontScale;
  const box = useMemo(
    () => ({ width, height: Math.max(lineHeight, line) }),
    [width, lineHeight, line],
  );
  return { fontScale, line, box };
}

export function LabelLineSpacer({ lineHeight, width }: LabelLineSpacerProps) {
  const { box } = useLabelLine(lineHeight, width);
  return <View style={box} />;
}

export function DrawnLineLabel({
  text,
  role,
  lineHeight,
  width,
  color,
}: DrawnLineLabelProps) {
  const { fontScale, line, box } = useLabelLine(lineHeight, width);
  const centre = useMemo(
    () => `translate(${String(width / 2)} ${String(line / 2)})`,
    [width, line],
  );
  return (
    <View style={box} pointerEvents="none" {...READER_HIDDEN}>
      {text.trim() === '' ? null : (
        <Svg style={StyleSheet.absoluteFill}>
          <SvgText
            transform={centre}
            textAnchor={ANCHOR_AT_CENTRE}
            alignmentBaseline={BASELINE_AT_CENTRE}
            fill={color}
            {...drawnFont(
              role,
              textRoles[role].size * fontScale,
              TABULAR_ROLES_ONLY,
            )}
          >
            {text}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}
