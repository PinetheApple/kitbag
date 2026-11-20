import { useCallback, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { space, textRoles } from '../roles.ts';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import type { NeighbourGaps } from '../touchTarget.ts';
import { PresetButton } from './PresetButton.tsx';
import { SheetHint } from './Sheet.tsx';
import { StepControl, type StepDelta } from './StepControl.tsx';

export const SHEET_STEPPER_GAPS = {
  top: space.sectionGap,
  bottom: space.sectionGap,
};

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: minTouchTargetDp,
  },
  label: {
    ...textStyle(textRoles.menuRow),
    color: theme.color.text,
    flexGrow: 1,
    flexShrink: 1,
  },
  presets: { flexDirection: 'row', gap: space.controlGap },
}));

export interface SpeedPresetOption {
  readonly value: number;
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly selected: boolean;
}

export interface SpeedStepperProps {
  readonly label: string;
  readonly value: string;
  readonly accented: boolean;
  readonly gaps: number | NeighbourGaps;
  readonly onStep: (delta: StepDelta) => void;
  readonly onOpen?: (() => void) | undefined;
}

export function SpeedStepper({
  label,
  value,
  accented,
  gaps,
  onStep,
  onOpen,
}: SpeedStepperProps) {
  return (
    <StepControl
      variant="inlineLarge"
      label={label}
      value={value}
      accented={accented}
      neighbourGapDp={gaps}
      onStep={onStep}
      {...(onOpen === undefined ? {} : { onValuePress: onOpen })}
    />
  );
}

export function StepperRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function SpeedPresetKey({
  option,
  onPick,
}: {
  readonly option: SpeedPresetOption;
  readonly onPick: (speed: number) => void;
}) {
  const pick = useCallback(() => {
    onPick(option.value);
  }, [onPick, option.value]);
  return (
    <PresetButton
      label={option.label}
      accessibilityLabel={option.accessibilityLabel}
      selected={option.selected}
      onPress={pick}
    />
  );
}

export interface SpeedGroupProps {
  readonly label: string;
  readonly value: string;
  readonly accented: boolean;
  readonly presets: readonly SpeedPresetOption[];
  readonly hint: string;
  readonly onStep: (delta: StepDelta) => void;
  readonly onPick: (speed: number) => void;
}

export function SpeedGroup({
  label,
  value,
  accented,
  presets,
  hint,
  onStep,
  onPick,
}: SpeedGroupProps) {
  const styles = useStyles();
  return (
    <>
      <StepperRow label={label}>
        <SpeedStepper
          label={label}
          value={value}
          accented={accented}
          gaps={SHEET_STEPPER_GAPS}
          onStep={onStep}
        />
      </StepperRow>
      <View style={styles.presets}>
        {presets.map((option) => (
          <SpeedPresetKey key={option.value} option={option} onPick={onPick} />
        ))}
      </View>
      <SheetHint>{hint}</SheetHint>
    </>
  );
}
