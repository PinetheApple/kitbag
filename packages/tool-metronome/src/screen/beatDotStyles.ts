import {
  createThemedStyles,
  metronome,
  metronomeMix,
  mixHex,
  radius,
  space,
  textRoles,
  textStyle,
  TRANSPARENT,
} from '@kitbag/core-design';

import { StyleSheet } from 'react-native';

import type { DotPalette } from '../logic/beatDot.ts';

const RING_REACH = metronome.dotRingGap + metronome.dotRing;

interface DotWidths {
  readonly normal: number;
  readonly accent: number;
  readonly silentNow: number;
}

export const DOT_WIDTHS: DotWidths = {
  normal: metronome.dotBorder,
  accent: metronome.dotAccentBorder,
  silentNow: metronome.dotSilentNowBorder,
};

const EDGE = { ...StyleSheet.absoluteFill, borderRadius: radius.circle };

export const PULSE_MARKS = {
  mark: metronome.pulseMark,
  gap: metronome.pulseMarkGap,
  radius: metronome.pulseMarkRadius,
};

function dotBorderColor(color: {
  readonly decor: string;
  readonly surface3: string;
}): string {
  return mixHex(color.decor, color.surface3, metronomeMix.dotBorder);
}

export const useBeatDotStyles = createThemedStyles((theme) => {
  const dotBorder = dotBorderColor(theme.color);
  return {
    lines: {
      alignItems: 'center',
    },
    line: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: metronome.beatDotGroupGap,
    },
    group: {
      flexDirection: 'row',
      gap: metronome.beatDotGap,
    },
    beat: {
      alignItems: 'center',
      gap: metronome.beatMarkerGap,
    },
    dot: {
      borderRadius: radius.circle,
      borderWidth: DOT_WIDTHS.normal,
    },
    accentEdge: {
      ...EDGE,
      borderWidth: DOT_WIDTHS.accent,
    },
    silentNowEdge: {
      ...EDGE,
      borderWidth: DOT_WIDTHS.silentNow,
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
      borderWidth: metronome.dotRing,
    },
    marker: {
      ...textStyle(textRoles.beatMarker),
      lineHeight: metronome.beatMarkerLineHeight,
      minHeight: metronome.beatMarkerLineHeight,
      color: theme.color.text2,
    },
    pulseRow: {
      height: metronome.pulseMark,
      justifyContent: 'center',
    },
    pulseMarks: {
      flexDirection: 'row',
    },
    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: metronome.legendGap,
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
      width: metronome.legendSwatch,
      height: metronome.legendSwatch,
      borderRadius: radius.circle,
    },
    swatchAccent: {
      borderWidth: metronome.legendAccentBorder,
      borderColor: theme.color.accent,
    },
    swatchNormal: {
      backgroundColor: theme.color.surface3,
      borderWidth: metronome.legendSwatchBorder,
      borderColor: dotBorder,
    },
    swatchMuted: {
      borderWidth: metronome.legendSwatchBorder,
      borderColor: theme.color.decor,
      borderStyle: 'dashed',
    },
  };
});

export function dotPalette(color: {
  readonly accent: string;
  readonly surface3: string;
  readonly decor: string;
  readonly text: string;
}): DotPalette {
  return {
    accent: color.accent,
    fill: color.surface3,
    border: dotBorderColor(color),
    hollow: color.decor,
    silentNow: color.text,
    clear: TRANSPARENT,
  };
}
