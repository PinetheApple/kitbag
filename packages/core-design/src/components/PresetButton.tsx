import { Pressable, View } from 'react-native';

import {
  inset,
  presetActionGrow,
  radius,
  size,
  space,
  textRoles,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';
import { useTextScaled } from '../useTextScaled.ts';
import { DesignFloorOneLineText } from './DesignFloorOneLineText.tsx';

export type PresetButtonKind = 'preset' | 'action';

// Widths are flex and well past 48dp, so only the vertical axis is grown.
function presetHitBox(gaps: NeighbourGaps) {
  return hitBoxStyle(
    hitExtension(minTouchTargetDp, size.presetButton, {
      top: gaps.top,
      bottom: gaps.bottom,
    }),
  );
}

export interface PresetButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly kind?: PresetButtonKind;
  readonly accessibilityLabel?: string;
  readonly selected?: boolean;
  /** Gaps to the controls above and below, for the 48dp hit box; a number
   * applies to both, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
}

const useStyles = createThemedStyles((theme) => ({
  presetHit: {
    flex: 1,
  },
  actionHit: {
    flex: presetActionGrow,
  },
  preset: {
    flexGrow: 1,
    minHeight: size.presetButton,
    borderRadius: radius.preset,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    ...textStyle(textRoles.preset),
    color: theme.color.text,
  },
  presetSelected: {
    backgroundColor: theme.activeControlFill,
    borderColor: theme.color.accentDim,
  },
  presetTextSelected: {
    color: theme.color[theme.accentInk],
  },
  action: {
    flexGrow: 1,
    minHeight: size.presetButton,
    borderRadius: radius.button,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaledFace: {
    paddingHorizontal: inset.presetLabelH,
  },
  labelBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  actionText: {
    ...textStyle(textRoles.presetAction),
    color: theme.color.text,
  },
}));

export function PresetButton({
  label,
  onPress,
  kind = 'preset',
  accessibilityLabel,
  selected = false,
  neighbourGapDp = space.controlGap,
}: PresetButtonProps) {
  const styles = useStyles();
  const action = kind === 'action';
  const scaled = useTextScaled();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[
        action ? styles.actionHit : styles.presetHit,
        presetHitBox(neighbourGaps(neighbourGapDp)),
      ]}
      onPress={onPress}
    >
      <View
        style={[
          action ? styles.action : styles.preset,
          selected && styles.presetSelected,
          scaled && styles.scaledFace,
        ]}
      >
        <DesignFloorOneLineText
          text={label}
          role={action ? textRoles.presetAction : textRoles.preset}
          style={[
            action ? styles.actionText : styles.presetText,
            selected && styles.presetTextSelected,
          ]}
          boxStyle={styles.labelBox}
        />
      </View>
    </Pressable>
  );
}
