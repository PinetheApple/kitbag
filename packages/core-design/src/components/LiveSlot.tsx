import {
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import type { TextRoleName } from '../roles.ts';
import { GhostText } from './GhostText.tsx';
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
      <GhostText role={role} text={widest} textStyle={textStyle} />
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
