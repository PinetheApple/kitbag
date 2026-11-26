import type { ReactNode } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import { READER_HIDDEN } from '../readerHiding.ts';
import { textRoles } from '../roles.ts';
import { drawnFont, TEXT_LINE_TOP, type PlainRoleName } from './drawnText.ts';
import { GhostText } from './GhostText.tsx';

export interface DrawnTextFrameProps {
  readonly role: PlainRoleName;
  readonly widest: string;
  readonly fill: string;
  readonly textStyle?: StyleProp<TextStyle>;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

export function DrawnTextFrame({
  role,
  widest,
  fill,
  textStyle,
  style,
  children,
}: DrawnTextFrameProps) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={style} pointerEvents="none" {...READER_HIDDEN}>
      <GhostText role={role} text={widest} textStyle={textStyle} />
      <Svg style={StyleSheet.absoluteFill}>
        <SvgText
          fill={fill}
          {...drawnFont(role, textRoles[role].size * fontScale)}
          alignmentBaseline={TEXT_LINE_TOP}
        >
          {children}
        </SvgText>
      </Svg>
    </View>
  );
}
