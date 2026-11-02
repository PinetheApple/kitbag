import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { textRoles, type TextRoleName } from '../roles.ts';
import { textStyle as roleStyle } from '../textStyle.ts';
import { LiveText, type LiveTextProps } from './LiveText.tsx';

export interface LiveSlotProps {
  readonly text: SharedValue<string>;
  readonly role: TextRoleName;
  readonly widest: string;
  readonly align?: LiveTextProps['align'];
  readonly textStyle?: StyleProp<TextStyle>;
  readonly style?: StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  ghost: { opacity: 0 },
  fill: { width: '100%' },
});

// A UI-thread text change never reaches layout, so the slot is sized by the
// widest string it can show, drawn invisibly underneath at the current font scale.
export function LiveSlot({
  text,
  role,
  widest,
  align = 'left',
  textStyle,
  style,
}: LiveSlotProps) {
  return (
    <View style={style}>
      <Text
        style={[
          roleStyle({ ...textRoles[role], tabular: true }),
          textStyle,
          styles.ghost,
        ]}
        numberOfLines={1}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {widest}
      </Text>
      <View style={StyleSheet.absoluteFill}>
        <LiveText
          text={text}
          role={role}
          align={align}
          style={[textStyle, styles.fill]}
        />
      </View>
    </View>
  );
}
