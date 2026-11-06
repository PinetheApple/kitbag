import {
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { oneLineFloor } from '../oneLineFit.ts';
import type { TypeRole } from '../tokens.ts';
import { useOneLineFit } from '../useOneLineFit.tsx';

export interface DesignFloorOneLineTextProps {
  readonly text: string;
  readonly role: TypeRole;
  readonly style: StyleProp<TextStyle>;
  readonly boxStyle?: StyleProp<ViewStyle>;
}

export function DesignFloorOneLineText({
  text,
  role,
  style,
  boxStyle,
}: DesignFloorOneLineTextProps) {
  const { fontScale } = useWindowDimensions();
  const fit = useOneLineFit({
    text,
    role,
    floor: oneLineFloor(fontScale, role.size, role.size),
    style,
  });
  return (
    <View style={boxStyle} onLayout={fit.onAvailableLayout}>
      {fit.measurer}
      <Text style={[style, fit.style]} numberOfLines={1} ellipsizeMode="tail">
        {text}
      </Text>
    </View>
  );
}
