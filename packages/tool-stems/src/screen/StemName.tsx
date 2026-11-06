import { oneLineFloor, textRoles, useOneLineFit } from '@kitbag/core-design';
import {
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

interface StemNameProps {
  readonly name: string;
  readonly style: StyleProp<TextStyle>;
  readonly boxStyle?: StyleProp<ViewStyle>;
}

export function StemName({ name, style, boxStyle }: StemNameProps) {
  const { fontScale } = useWindowDimensions();
  const role = textRoles.stemName;
  const fit = useOneLineFit({
    text: name,
    role,
    floor: oneLineFloor(fontScale, role.size, role.size),
    style,
  });
  return (
    <View style={boxStyle} onLayout={fit.onAvailableLayout}>
      {fit.measurer}
      <Text style={[style, fit.style]} numberOfLines={1} ellipsizeMode="tail">
        {name}
      </Text>
    </View>
  );
}
