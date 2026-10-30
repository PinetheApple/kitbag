import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { notationGeometry as g, notationLayout } from '../notation.ts';
import { textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { useTheme } from '../ThemeProvider.tsx';
import { ledRadius, type ColorToken } from '../tokens.ts';

// RN cannot place a text baseline; with lineHeight = fontSize the baseline sits
// about this far down the line box.
const NUMERAL_BASELINE_RATIO = 0.8;
const NUMERAL_BOX_EMS = 3;

export interface NotationGlyphProps {
  readonly subdivision: number;
  readonly height: number;
  readonly color?: ColorToken;
}

export function NotationGlyph({
  subdivision,
  height,
  color = 'text',
}: NotationGlyphProps) {
  const theme = useTheme();
  const ink = theme.color[color];
  const scale = height / g.height;
  const layout = useMemo(() => notationLayout(subdivision), [subdivision]);
  const numeralSize = textRoles.notationNumeral.size * scale;
  const numeralBox = numeralSize * NUMERAL_BOX_EMS;

  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: layout.width * scale, height }}
    >
      {layout.headXs.map((x) => (
        <View
          key={`head${String(x)}`}
          style={{
            position: 'absolute',
            left: (x - g.headWidth / 2) * scale,
            top: (g.headY - g.headHeight / 2) * scale,
            width: g.headWidth * scale,
            height: g.headHeight * scale,
            borderRadius: ledRadius,
            backgroundColor: ink,
            transform: [{ rotate: `${String(g.headTiltDeg)}deg` }],
          }}
        />
      ))}
      {layout.stemXs.map((x) => (
        <View
          key={`stem${String(x)}`}
          style={{
            position: 'absolute',
            left: x * scale,
            top: g.stemTop * scale,
            width: g.stemWidth * scale,
            height: g.stemHeight * scale,
            backgroundColor: ink,
          }}
        />
      ))}
      {layout.beams.map((beam) => (
        <View
          key={`beam${String(beam.y)}`}
          style={{
            position: 'absolute',
            left: layout.beamX * scale,
            top: beam.y * scale,
            width: layout.beamWidth * scale,
            height: g.beamThickness * scale,
            backgroundColor: ink,
          }}
        />
      ))}
      {layout.numeral === null ? null : (
        <Text
          allowFontScaling={false}
          style={{
            ...textStyle(textRoles.notationNumeral),
            fontSize: numeralSize,
            lineHeight: numeralSize,
            includeFontPadding: false,
            position: 'absolute',
            left: layout.numeral.x * scale - numeralBox / 2,
            top:
              g.numeralBaseline * scale - numeralSize * NUMERAL_BASELINE_RATIO,
            width: numeralBox,
            textAlign: 'center',
            color: ink,
          }}
        >
          {layout.numeral.text}
        </Text>
      )}
    </View>
  );
}
