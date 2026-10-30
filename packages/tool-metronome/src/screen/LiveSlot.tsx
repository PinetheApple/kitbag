import { LiveText, type TextRoleName } from '@kitbag/core-design';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { useStatusStyles } from './statusStyles.ts';

interface LiveSlotProps {
  readonly text: SharedValue<string>;
  readonly role: TextRoleName;
  readonly widest: string;
  readonly textStyle: StyleProp<TextStyle>;
  readonly style?: StyleProp<ViewStyle>;
}

// A UI-thread text change never reaches layout, so the slot is sized by the
// widest string it can show, drawn invisibly underneath.
export function LiveSlot({
  text,
  role,
  widest,
  textStyle,
  style,
}: LiveSlotProps) {
  const styles = useStatusStyles();
  return (
    <View style={style}>
      <Text style={[textStyle, styles.ghost]} numberOfLines={1}>
        {widest}
      </Text>
      <View style={StyleSheet.absoluteFill}>
        <LiveText
          text={text}
          role={role}
          align="left"
          style={[textStyle, styles.slotFill]}
        />
      </View>
    </View>
  );
}
