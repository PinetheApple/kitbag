import { TextInput, type TextInputProps } from 'react-native';
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';

import { textRoles, type TextRoleName } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { useTheme } from '../ThemeProvider.tsx';
import type { ColorToken } from '../tokens.ts';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface LiveTextProps {
  readonly text: SharedValue<string>;
  readonly role: TextRoleName;
  readonly color?: ColorToken;
  readonly align?: 'left' | 'center' | 'right';
}

// Hidden from screen readers: a value changing at measurement rate would flood
// them. The owning screen announces state changes through its own live region.
export function LiveText({
  text,
  role,
  color = 'text',
  align = 'center',
}: LiveTextProps) {
  const theme = useTheme();
  const animatedProps = useAnimatedProps(() => {
    const value = text.value;
    // `text` is the native prop a TextInput reads from the UI thread; it is not
    // in TextInputProps, hence the cast.
    return {
      text: value,
      defaultValue: value,
    } as unknown as Partial<TextInputProps>;
  });

  return (
    <AnimatedTextInput
      editable={false}
      focusable={false}
      caretHidden
      contextMenuHidden
      scrollEnabled={false}
      underlineColorAndroid="transparent"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        textStyle({ ...textRoles[role], tabular: true }),
        {
          color: theme.color[color],
          textAlign: align,
          padding: 0,
          pointerEvents: 'none',
        },
      ]}
      animatedProps={animatedProps}
    />
  );
}
