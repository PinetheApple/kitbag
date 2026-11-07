import {
  StyleSheet,
  Text,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { ellipsisPaintSize } from '../oneLineFit.ts';
import { isTextScaled } from '../textScale.ts';

export interface EllipsizedLineProps {
  readonly style: StyleProp<TextStyle>;
  readonly children: string;
  readonly numberOfLines?: number | undefined;
}

const ONE_LINE = 1;

// The parent sizes the view paint Android reserves the ellipsis with; it also
// takes useOneLineFit's hiding opacity, which on a nested Text is only a span.
export function EllipsizedLine({
  style,
  children,
  numberOfLines = ONE_LINE,
}: EllipsizedLineProps) {
  const { fontScale } = useWindowDimensions();
  const { fontSize, opacity } = StyleSheet.flatten(style);
  if (fontSize === undefined || !isTextScaled(fontScale) || children === '')
    return (
      <Text style={style} numberOfLines={numberOfLines} ellipsizeMode="tail">
        {children}
      </Text>
    );
  return (
    <Text
      style={{ fontSize: ellipsisPaintSize(fontSize, fontScale), opacity }}
      numberOfLines={numberOfLines}
      ellipsizeMode="tail"
    >
      <Text style={style}>{children}</Text>
    </Text>
  );
}
