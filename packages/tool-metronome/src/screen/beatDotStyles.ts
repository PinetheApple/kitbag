import {
  beatMarkerLineHeight,
  createThemedStyles,
  mix,
  mixHex,
  radius,
  size,
  space,
  textRoles,
  textStyle,
  TRANSPARENT,
} from '@kitbag/core-design';

import type { DotPalette, DotWidths } from '../logic/beatDot.ts';

const RING_REACH = size.dotRingGap + size.dotRing;

export const DOT_WIDTHS: DotWidths = {
  normal: size.dotBorder,
  accent: size.dotAccentBorder,
  silentNow: size.dotSilentNowBorder,
};

export const DOT_METRICS = {
  maxDot: size.beatDotMax,
  dotGap: space.beatDotGap,
  groupGap: space.beatDotGroupGap,
};

export const LINE_PITCH_GAP =
  space.beatMarkerGap + beatMarkerLineHeight + space.beatDotLineGap;

function dotBorderColor(color: {
  readonly text3: string;
  readonly surface3: string;
}): string {
  return mixHex(color.text3, color.surface3, mix.dotBorder);
}

export const useBeatDotStyles = createThemedStyles((theme) => {
  const dotBorder = dotBorderColor(theme.color);
  return {
    lines: {
      alignItems: 'center',
      gap: space.beatDotLineGap,
    },
    line: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: space.beatDotGroupGap,
    },
    group: {
      flexDirection: 'row',
      gap: space.beatDotGap,
    },
    beat: {
      alignItems: 'center',
      gap: space.beatMarkerGap,
    },
    dot: {
      borderRadius: radius.circle,
    },
    dashed: {
      borderStyle: 'dashed',
    },
    ring: {
      position: 'absolute',
      top: -RING_REACH,
      right: -RING_REACH,
      bottom: -RING_REACH,
      left: -RING_REACH,
      borderRadius: radius.circle,
      borderWidth: size.dotRing,
      borderColor: theme.color.accent,
    },
    marker: {
      ...textStyle(textRoles.beatMarker),
      lineHeight: beatMarkerLineHeight,
      minHeight: beatMarkerLineHeight,
      color: theme.color.text2,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    square: {
      borderRadius: radius.countSquare,
      borderWidth: size.countSquareBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    squareNumber: {
      ...textStyle(textRoles.countSquare),
      includeFontPadding: false,
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: space.legendGap,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.chipGap,
    },
    legendLabel: {
      ...textStyle(textRoles.legend),
      color: theme.color.text2,
    },
    swatch: {
      width: size.legendSwatch,
      height: size.legendSwatch,
      borderRadius: radius.circle,
    },
    swatchAccent: {
      borderWidth: size.legendAccentBorder,
      borderColor: theme.color.accent,
    },
    swatchNormal: {
      backgroundColor: theme.color.surface3,
      borderWidth: size.legendSwatchBorder,
      borderColor: dotBorder,
    },
    swatchMuted: {
      borderWidth: size.legendSwatchBorder,
      borderColor: theme.color.text3,
      borderStyle: 'dashed',
    },
  };
});

export function dotPalette(color: {
  readonly accent: string;
  readonly surface3: string;
  readonly text3: string;
  readonly text: string;
}): DotPalette {
  return {
    accent: color.accent,
    fill: color.surface3,
    border: dotBorderColor(color),
    hollow: color.text3,
    silentNow: color.text,
    clear: TRANSPARENT,
  };
}
