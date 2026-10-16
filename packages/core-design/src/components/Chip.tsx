import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { AnyIconName } from '../icons.ts';
import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';
import { Icon } from './Icon.tsx';

const CHIP_HEIGHT = textRoles.chip.size + (inset.chipV + size.stroke) * 2;

// A chip's width follows its label and is nearly always past 48dp, so only the
// vertical axis is grown.
function chipHitBox(gaps: NeighbourGaps) {
  return hitBoxStyle(
    hitExtension(minTouchTargetDp, CHIP_HEIGHT, {
      top: gaps.top,
      bottom: gaps.bottom,
    }),
  );
}

interface ChipFaceProps {
  readonly label: string;
  readonly icon?: AnyIconName | undefined;
  readonly trailingIcon?: AnyIconName | undefined;
  readonly active: boolean;
  readonly liveDot: boolean;
}

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.controlGap,
  },
  chipHit: {
    alignSelf: 'flex-start',
    flexShrink: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    gap: space.chipGap,
    paddingVertical: inset.chipV,
    paddingHorizontal: inset.chipH,
    borderRadius: radius.chip,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
  },
  chipActive: {
    backgroundColor: theme.activeControlFill,
    borderColor: theme.color.accentDim,
  },
  fill: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  fillFace: {
    alignSelf: 'stretch',
  },
  label: {
    ...textStyle(textRoles.chip),
    color: theme.color.text2,
    flexShrink: 1,
  },
  labelActive: {
    color: theme.color.accent,
  },
  liveDot: {
    width: size.liveDot,
    height: size.liveDot,
    borderRadius: radius.circle,
    backgroundColor: theme.color.green,
  },
}));

function ChipFace({
  label,
  icon,
  trailingIcon,
  active,
  liveDot,
}: ChipFaceProps) {
  const styles = useStyles();
  const glyphColor = active ? 'accent' : 'text2';
  return (
    <>
      {liveDot ? <View style={styles.liveDot} /> : null}
      {icon === undefined ? null : (
        <Icon name={icon} size="chip" color={glyphColor} />
      )}
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {trailingIcon === undefined ? null : (
        <Icon name={trailingIcon} size="chip" color={glyphColor} />
      )}
    </>
  );
}

export interface ChipProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: AnyIconName;
  readonly trailingIcon?: AnyIconName;
  readonly active?: boolean;
  readonly liveDot?: boolean;
  readonly fill?: boolean;
  readonly accessibilityLabel?: string;
  /** Gaps to the controls above and below, for the 48dp hit box; a number
   * applies to both, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
}

export function Chip({
  label,
  onPress,
  icon,
  trailingIcon,
  active = false,
  liveDot = false,
  fill = false,
  accessibilityLabel,
  neighbourGapDp = space.controlGap,
}: ChipProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      style={[
        styles.chipHit,
        chipHitBox(neighbourGaps(neighbourGapDp)),
        fill && styles.fill,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.chip,
          active && styles.chipActive,
          fill && [styles.fill, styles.fillFace],
        ]}
      >
        <ChipFace
          label={label}
          icon={icon}
          trailingIcon={trailingIcon}
          active={active}
          liveDot={liveDot}
        />
      </View>
    </Pressable>
  );
}

export interface StatusPillProps {
  readonly label: string;
  readonly icon?: AnyIconName;
  readonly active?: boolean;
  readonly liveDot?: boolean;
}

export function StatusPill({
  label,
  icon,
  active = false,
  liveDot = false,
}: StatusPillProps) {
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.chip, active && styles.chipActive]}
    >
      <ChipFace label={label} icon={icon} active={active} liveDot={liveDot} />
    </View>
  );
}

export interface ChipRowProps {
  readonly children: ReactNode;
}

export function ChipRow({ children }: ChipRowProps) {
  const styles = useStyles();
  return <View style={styles.row}>{children}</View>;
}
