import { Text, View } from 'react-native';

import { icons, isShapeIcon, type AnyIconName } from '../icons.ts';
import { iconSizes, type IconSize } from '../roles.ts';
import { useTheme } from '../ThemeProvider.tsx';
import type { ColorToken } from '../tokens.ts';
import { ShapeGlyph } from './ShapeIcon.tsx';

export interface IconProps {
  readonly name: AnyIconName;
  readonly size?: IconSize;
  readonly color?: ColorToken;
  readonly accessibilityLabel?: string;
}

export function Icon({
  name,
  size = 'action',
  color = 'text2',
  accessibilityLabel,
}: IconProps) {
  const theme = useTheme();
  const labelled = accessibilityLabel !== undefined;
  const a11y = {
    accessible: labelled,
    importantForAccessibility: labelled ? 'yes' : 'no-hide-descendants',
    ...(labelled ? { accessibilityLabel } : {}),
  } as const;
  if (isShapeIcon(name)) {
    return (
      <View {...a11y}>
        <ShapeGlyph
          name={name}
          px={iconSizes[size]}
          color={theme.color[color]}
        />
      </View>
    );
  }
  return (
    <Text
      {...a11y}
      style={{
        color: theme.color[color],
        fontSize: iconSizes[size],
        lineHeight: iconSizes[size],
      }}
    >
      {icons[name]}
    </Text>
  );
}
