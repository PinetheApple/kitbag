import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  type DerivedValue,
} from 'react-native-reanimated';
import Svg, { Text as SvgText, TSpan, type TSpanProps } from 'react-native-svg';

import { fontFace } from '../fontFaces.ts';
import { READER_HIDDEN } from '../readerHiding.ts';
import { textRoles } from '../roles.ts';
import {
  TABULAR_FIGURES,
  TEXT_LINE_TOP,
  type PlainRoleName,
} from './DrawnFigures.tsx';
import { GhostText } from './GhostText.tsx';

const AnimatedTSpan = Animated.createAnimatedComponent(TSpan);

export interface DrawnLiveSlotProps {
  readonly text: DerivedValue<string>;
  readonly role: PlainRoleName;
  readonly widest: string;
  readonly color: string;
  readonly textStyle?: StyleProp<TextStyle>;
  readonly style?: StyleProp<ViewStyle>;
}

export function DrawnLiveSlot({
  text,
  role,
  widest,
  color,
  textStyle,
  style,
}: DrawnLiveSlotProps) {
  const { fontScale } = useWindowDimensions();
  const face = textRoles[role];
  // `content` is the native prop a TSpan draws; TSpanProps derive it from children.
  const content = useAnimatedProps(
    () => ({ content: text.value }) as unknown as Partial<TSpanProps>,
  );
  return (
    <View style={style} pointerEvents="none" {...READER_HIDDEN}>
      <GhostText role={role} text={widest} textStyle={textStyle} />
      <Svg style={StyleSheet.absoluteFill}>
        <SvgText
          fill={color}
          fontFamily={fontFace(face.family, face.weight)}
          fontSize={face.size * fontScale}
          fontFeatureSettings={TABULAR_FIGURES}
          alignmentBaseline={TEXT_LINE_TOP}
        >
          <AnimatedTSpan animatedProps={content} />
        </SvgText>
      </Svg>
    </View>
  );
}
