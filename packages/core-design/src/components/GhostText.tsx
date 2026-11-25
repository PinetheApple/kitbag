import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { textRoles, type TextRoleName } from '../roles.ts';
import { textStyle as roleStyle } from '../textStyle.ts';

export interface GhostTextProps {
  readonly role: TextRoleName;
  readonly text: string;
  readonly textStyle?: StyleProp<TextStyle>;
}

const styles = StyleSheet.create({
  ghost: { opacity: 0 },
});

export function GhostText({ role, text, textStyle }: GhostTextProps) {
  return (
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
      {text}
    </Text>
  );
}
