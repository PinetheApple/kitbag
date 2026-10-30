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

import type { DotPalette, DotWidths } from '../logic/beatDot.ts';
import { BEAT_LABEL_HEIGHT } from '../logic/belowTempo.ts';

const RING_REACH = metronome.dotRingGap + metronome.dotRing;

export const DOT_WIDTHS: DotWidths = {
  normal: metronome.dotBorder,
  accent: metronome.dotAccentBorder,
  silentNow: metronome.dotSilentNowBorder,
};

export const PULSE_MARKS = {
  mark: metronome.pulseMark,
  gap: metronome.pulseMarkGap,
  radius: metronome.pulseMarkRadius,
};

export const LINE_PITCH_GAP = BEAT_LABEL_HEIGHT + metronome.beatDotLineGap;

function dotBorderColor(color: {
  readonly text3: string;
  readonly surface3: string;
}): string {
  return mixHex(color.text3, color.surface3, metronomeMix.dotBorder);
}

export const useBeatDotStyles = createThemedStyles((theme) => {
  const dotBorder = dotBorderColor(theme.color);
  return {
    lines: {
      alignItems: 'center',
      gap: metronome.beatDotLineGap,
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
      borderColor: theme.color.accent,
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
    pulseMark: {
      backgroundColor: theme.color.surface3,
    },
    pulseLit: {
      position: 'absolute',
      top: 0,
      left: 0,
      backgroundColor: theme.color.accent,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    square: {
      borderRadius: metronome.countSquareRadius,
      borderWidth: metronome.countSquareBorder,
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
