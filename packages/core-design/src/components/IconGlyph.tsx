import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { iconGlyphs, type IconName } from '../icons.ts';
import { iconSizes } from '../roles.ts';
import { useTheme } from '../ThemeProvider.tsx';

const styles = StyleSheet.create({ inline: { justifyContent: 'center' } });

export interface IconGlyphProps {
  readonly name: IconName;
  readonly px: number;
  readonly color: string;
}

/** The bare vector glyph, for callers that size by pixels rather than role. */
export function IconGlyph({ name, px, color }: IconGlyphProps) {
  return (
    <MaterialCommunityIcons name={iconGlyphs[name]} size={px} color={color} />
  );
}

export interface InlineIconProps {
  readonly name: IconName;
  readonly style: StyleProp<TextStyle>;
}

/** A glyph sized and coloured by the text style it replaces. Decorative. */
export function InlineIcon({ name, style }: InlineIconProps) {
  const theme = useTheme();
  const flat = StyleSheet.flatten(style);
  const color = typeof flat.color === 'string' ? flat.color : theme.color.text2;
  return (
    <View importantForAccessibility="no-hide-descendants" style={styles.inline}>
      <IconGlyph
        name={name}
        px={flat.fontSize ?? iconSizes.action}
        color={color}
      />
    </View>
  );
}
