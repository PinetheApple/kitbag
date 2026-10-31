import { mix, radius, size } from './roles.ts';
import { mixHex, type Theme } from './theme.ts';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  type NeighbourGaps,
} from './touchTarget.ts';

export const switchKnobTravel =
  size.switchWidth - size.stroke * 2 - size.switchKnob - size.switchKnobInset;

export function switchStyles(theme: Theme) {
  const { color } = theme;
  return {
    track: {
      width: size.switchWidth,
      height: size.switchHeight,
      borderRadius: radius.switch,
      borderWidth: size.stroke,
      borderColor: color.line,
      backgroundColor: color.surface3,
    },
    trackOn: {
      borderColor: color.accentDim,
      backgroundColor: mixHex(color.accent, color.surface3, mix.switchOn),
    },
    knob: {
      position: 'absolute' as const,
      top: size.switchKnobInset,
      left: size.switchKnobInset,
      width: size.switchKnob,
      height: size.switchKnob,
      borderRadius: radius.circle,
      backgroundColor: color.text3,
    },
    knobOn: { left: switchKnobTravel, backgroundColor: color.accent },
  };
}

export function switchA11y(value: boolean) {
  return {
    accessibilityRole: 'switch' as const,
    accessibilityState: { checked: value },
    'aria-checked': value,
  };
}

export function switchHitBox(gaps?: number | NeighbourGaps) {
  return hitBoxStyle(
    hitExtension(size.switchWidth, size.switchHeight, neighbourGaps(gaps)),
  );
}
