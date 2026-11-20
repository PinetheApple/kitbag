import { useCallback } from 'react';
import { View } from 'react-native';

import { space } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import type { NeighbourGaps } from '../touchTarget.ts';
import { PresetButton } from './PresetButton.tsx';
import { SheetHint } from './Sheet.tsx';
import { StepControl, type StepDelta } from './StepControl.tsx';
import { SHEET_STEPPER_GAPS, StepperRow } from './StepperRow.tsx';

const useStyles = createThemedStyles(() => ({
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
      onValuePress={onOpen}
    />
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
