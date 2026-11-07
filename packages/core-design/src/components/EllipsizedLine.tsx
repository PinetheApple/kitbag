import {
  StyleSheet,
  Text,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { ellipsisPaintSize } from '../oneLineFit.ts';

export interface EllipsizedLineProps {
  readonly style: StyleProp<TextStyle>;
  readonly children: string;
}

export function EllipsizedLine({ style, children }: EllipsizedLineProps) {
  const { fontScale } = useWindowDimensions();
  const { fontSize, opacity } = StyleSheet.flatten(style);
  const paintSize =
    fontSize === undefined ? undefined : ellipsisPaintSize(fontSize, fontScale);
  if (paintSize === undefined)
    return (
      <Text style={style} numberOfLines={1} ellipsizeMode="tail">
        {children}
      </Text>
    );
  return (
    <Text
      style={{ fontSize: paintSize, opacity }}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      <Text style={style}>{children}</Text>
    </Text>
  );
}
