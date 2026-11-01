import { Pressable, Text, View } from 'react-native';

import { presetActionGrow, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';

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
  neighbourGapDp = space.controlGap,
}: PresetButtonProps) {
  const styles = useStyles();
  const action = kind === 'action';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        action ? styles.actionHit : styles.presetHit,
        presetHitBox(neighbourGaps(neighbourGapDp)),
      ]}
      onPress={onPress}
    >
      <View style={action ? styles.action : styles.preset}>
        <Text style={action ? styles.actionText : styles.presetText}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
