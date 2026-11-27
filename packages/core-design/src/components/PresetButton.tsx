import { Pressable, View, type GestureResponderEvent } from 'react-native';

import {
  iconSizes,
  inset,
  presetActionGrow,
  radius,
  size,
  space,
  textRoles,
} from '../roles.ts';
import type { IconName } from '../icons.ts';
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
import { InlineIcon } from './IconGlyph.tsx';

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

type PresetPress =
  | { readonly onPress: () => void; readonly onPressIn?: never }
  | {
      readonly onPressIn: (event: GestureResponderEvent) => void;
      readonly onPress?: never;
    };

interface PresetButtonBaseProps {
  readonly label: string;
  readonly kind?: PresetButtonKind;
  readonly accessibilityLabel?: string;
  readonly selected?: boolean;
  readonly icon?: IconName;
  readonly iconAt?: 'start' | 'end';
  /** Gaps to the controls above and below, for the 48dp hit box; a number
   * applies to both, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
}

export type PresetButtonProps = PresetButtonBaseProps & PresetPress;

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
  withIcon: { flexDirection: 'row', gap: space.inlineKeyGap },
  iconFirst: { flexDirection: 'row-reverse' },
  icon: { fontSize: iconSizes.action, color: theme.color.text },
  actionText: {
    ...textStyle(textRoles.presetAction),
    color: theme.color.text,
  },
}));

export function PresetButton({
  label,
  onPress,
  onPressIn,
  kind = 'preset',
  accessibilityLabel,
  selected = false,
  icon,
  iconAt = 'start',
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
      onPressIn={onPressIn}
    >
      <View
        style={[
          action ? styles.action : styles.preset,
          selected && styles.presetSelected,
          scaled && styles.scaledFace,
          icon !== undefined && styles.withIcon,
          icon !== undefined && iconAt === 'start' && styles.iconFirst,
        ]}
      >
        <DesignFloorOneLineText
          text={label}
          role={action ? textRoles.presetAction : textRoles.preset}
          style={[
            action ? styles.actionText : styles.presetText,
            selected && styles.presetTextSelected,
          ]}
          boxStyle={icon === undefined ? styles.labelBox : undefined}
        />
        {icon === undefined ? null : (
          <InlineIcon name={icon} style={styles.icon} />
        )}
      </View>
    </Pressable>
  );
}
