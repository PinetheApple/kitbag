import { Text } from 'react-native';

import { icons, type IconName } from '../icons.ts';
import { iconSizes, type IconSize } from '../roles.ts';
import { useTheme } from '../ThemeProvider.tsx';
import type { ColorToken } from '../tokens.ts';

export interface IconProps {
  readonly name: IconName;
  readonly size?: IconSize;
  readonly color?: ColorToken;
  /** Given only when the icon carries meaning its surroundings do not. */
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
  return (
    <Text
      accessible={labelled}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
      {...(labelled ? { accessibilityLabel } : {})}
      style={{ color: theme.color[color], fontSize: iconSizes[size] }}
    >
      {icons[name]}
    </Text>
  );
}
