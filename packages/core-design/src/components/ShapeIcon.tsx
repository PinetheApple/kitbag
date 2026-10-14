import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { ShapeIconName } from '../icons.ts';
import { iconSizes, type IconSize } from '../roles.ts';
import { useTheme } from '../ThemeProvider.tsx';
import type { ColorToken } from '../tokens.ts';
import { tuneGlyph, type TuneGlyph } from '../tunerVisuals.ts';

const TRANSPARENT = 'transparent';
const HALF = 0.5;

// Proportions of the icon box, so every shape scales with the icon size role.
const ARROW = {
  headHalfWidth: 0.36,
  headHeight: 0.42,
  stemWidth: 0.16,
  stemHeight: 0.46,
} as const;
const CHECK = { width: 0.32, height: 0.6, stroke: 0.15, lift: 0.1 } as const;
const MIC = {
  capsuleWidth: 0.4,
  capsuleHeight: 0.54,
  cradleWidth: 0.66,
  cradleHeight: 0.36,
  cradleOverlap: 0.2,
  stroke: 0.1,
  stemHeight: 0.1,
  baseWidth: 0.42,
} as const;

interface ShapeProps {
  readonly px: number;
  readonly color: string;
}

function Arrow({ px, color, down }: ShapeProps & { readonly down: boolean }) {
  return (
    <View
      style={{
        width: px,
        height: px,
        alignItems: 'center',
        justifyContent: 'center',
        transform: down ? [{ rotate: '180deg' }] : [],
      }}
    >
      <View
        style={{
          borderLeftWidth: px * ARROW.headHalfWidth,
          borderRightWidth: px * ARROW.headHalfWidth,
          borderBottomWidth: px * ARROW.headHeight,
          borderLeftColor: TRANSPARENT,
          borderRightColor: TRANSPARENT,
          borderBottomColor: color,
        }}
      />
      <View
        style={{
          width: px * ARROW.stemWidth,
          height: px * ARROW.stemHeight,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function Check({ px, color }: ShapeProps) {
  return (
    <View
      style={{
        width: px,
        height: px,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: px * CHECK.width,
          height: px * CHECK.height,
          marginTop: -px * CHECK.lift,
          borderRightWidth: px * CHECK.stroke,
          borderBottomWidth: px * CHECK.stroke,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

function Mic({ px, color }: ShapeProps) {
  const stroke = px * MIC.stroke;
  return (
    <View
      style={{
        width: px,
        height: px,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: px * MIC.capsuleWidth,
          height: px * MIC.capsuleHeight,
          borderRadius: px * MIC.capsuleWidth * HALF,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: px * MIC.cradleWidth,
          height: px * MIC.cradleHeight,
          marginTop: -px * MIC.cradleOverlap,
          borderLeftWidth: stroke,
          borderRightWidth: stroke,
          borderBottomWidth: stroke,
          borderColor: color,
          borderBottomLeftRadius: px * MIC.cradleWidth * HALF,
          borderBottomRightRadius: px * MIC.cradleWidth * HALF,
        }}
      />
      <View
        style={{
          width: stroke,
          height: px * MIC.stemHeight,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: px * MIC.baseWidth,
          height: stroke,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export interface ShapeGlyphProps {
  readonly name: ShapeIconName;
  readonly px: number;
  readonly color: string;
}

export function ShapeGlyph({ name, px, color }: ShapeGlyphProps) {
  switch (name) {
    case 'arrowUp':
      return <Arrow px={px} color={color} down={false} />;
    case 'arrowDown':
      return <Arrow px={px} color={color} down />;
    case 'check':
      return <Check px={px} color={color} />;
    case 'mic':
      return <Mic px={px} color={color} />;
  }
}

const GLYPHS: readonly Exclude<TuneGlyph, 'none'>[] = ['up', 'down', 'inTune'];
const GLYPH_SHAPE: Readonly<Record<Exclude<TuneGlyph, 'none'>, ShapeIconName>> =
  { up: 'arrowUp', down: 'arrowDown', inTune: 'check' };

function DirectionLayer({
  glyph,
  direction,
  px,
  color,
}: {
  readonly glyph: Exclude<TuneGlyph, 'none'>;
  readonly direction: SharedValue<number>;
  readonly px: number;
  readonly color: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: tuneGlyph(direction.value) === glyph ? 1 : 0,
  }));
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, style]}>
      <ShapeGlyph name={GLYPH_SHAPE[glyph]} px={px} color={color} />
    </Animated.View>
  );
}

export interface TuneDirectionIconProps {
  readonly direction: SharedValue<number>;
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
