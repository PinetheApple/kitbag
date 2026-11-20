import {
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export function flatStyle<T extends ViewStyle | TextStyle>(
  style: StyleProp<T>,
): T {
  return (StyleSheet.flatten(style) ?? {}) as T;
}
