import { Pressable, Text } from 'react-native';

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
import { hitSlopForPadded } from '../touchTarget.ts';

export type PresetButtonKind = 'preset' | 'action';

const HIT_SLOP: Readonly<Record<PresetButtonKind, number>> = {
  preset: hitSlopForPadded(
    textRoles.preset.size,
    inset.presetV,
    space.controlGap,
  ),
  action: hitSlopForPadded(
    textRoles.presetAction.size,
    inset.buttonV,
    space.controlGap,
  ),
};

export interface PresetButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly kind?: PresetButtonKind;
  readonly accessibilityLabel?: string;
}

const useStyles = createThemedStyles((theme) => ({
  preset: {
    flex: 1,
    paddingVertical: inset.presetV,
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
    flex: presetActionGrow,
    paddingVertical: inset.buttonV,
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
}: PresetButtonProps) {
  const styles = useStyles();
  const action = kind === 'action';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={action ? styles.action : styles.preset}
      hitSlop={HIT_SLOP[kind]}
      onPress={onPress}
    >
      <Text style={action ? styles.actionText : styles.presetText}>
        {label}
      </Text>
    </Pressable>
  );
}
