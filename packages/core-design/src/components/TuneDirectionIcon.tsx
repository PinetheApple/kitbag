import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { IconName } from '../icons.ts';
import { iconSizes, type IconSize } from '../roles.ts';
import { useTheme } from '../ThemeProvider.tsx';
import type { ColorToken } from '../tokens.ts';
import type { TuneGlyph } from '../tunerVisuals.ts';
import { IconGlyph } from './IconGlyph.tsx';

const GLYPHS: readonly Exclude<TuneGlyph, 'none'>[] = ['up', 'down', 'inTune'];
const GLYPH_ICON: Readonly<Record<Exclude<TuneGlyph, 'none'>, IconName>> = {
  up: 'arrowUp',
  down: 'arrowDown',
  inTune: 'check',
};

function DirectionLayer({
  glyph,
  direction,
  px,
  color,
}: {
  readonly glyph: Exclude<TuneGlyph, 'none'>;
  readonly direction: SharedValue<TuneGlyph>;
  readonly px: number;
  readonly color: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: direction.value === glyph ? 1 : 0,
  }));
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, style]}>
      <IconGlyph name={GLYPH_ICON[glyph]} px={px} color={color} />
    </Animated.View>
  );
}

export interface TuneDirectionIconProps {
  readonly direction: SharedValue<TuneGlyph>;
  readonly size?: IconSize;
  readonly color?: ColorToken;
}

// Decorative: the screen's status text carries the direction for screen readers.
export function TuneDirectionIcon({
  direction,
  size = 'control',
  color = 'text2',
}: TuneDirectionIconProps) {
  const theme = useTheme();
  const px = iconSizes[size];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: px, height: px }}
    >
      {GLYPHS.map((glyph) => (
        <DirectionLayer
          key={glyph}
          glyph={glyph}
          direction={direction}
          px={px}
          color={theme.color[color]}
        />
      ))}
    </View>
  );
}
