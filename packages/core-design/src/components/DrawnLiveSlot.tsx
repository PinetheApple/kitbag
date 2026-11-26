import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  type DerivedValue,
} from 'react-native-reanimated';
import { TSpan, type TSpanProps } from 'react-native-svg';

import type { PlainRoleName } from './drawnText.ts';
import { DrawnTextFrame } from './DrawnTextFrame.tsx';

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
  // `content` is the native prop a TSpan draws; TSpanProps derive it from children.
  const content = useAnimatedProps(
    () => ({ content: text.value }) as unknown as Partial<TSpanProps>,
  );
  return (
    <DrawnTextFrame
      role={role}
      widest={widest}
      fill={color}
      textStyle={textStyle}
      style={style}
    >
      <AnimatedTSpan animatedProps={content}>{text.value}</AnimatedTSpan>
    </DrawnTextFrame>
  );
}
