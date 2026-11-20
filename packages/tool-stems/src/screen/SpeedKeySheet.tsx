import {
  createThemedStyles,
  Icon,
  SHEET_STEPPER_GAPS,
  Sheet,
  SheetHint,
  size,
  SpeedGroup,
  stemPlayer,
  StepperRow,
  textRoles,
  textStyle,
  useTextScaled,
} from '@kitbag/core-design';
import {
  isUnitySpeed,
  keyHint,
  speedHint,
  speedKeyCopy,
  speedPercentText,
  speedPresetTexts,
  useStemPlayer,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { perStemSummary } from '../logic/stemKeyText.ts';
import { SongKeyStepper, usePlayerSpeedStep } from './SpeedKeyDock.tsx';
import { StemKeyRows } from './StemKeyRows.tsx';

export const PER_STEM_STACKED_ID = 'per-stem-stacked';

const useStyles = createThemedStyles((theme) => ({
  label: {
    ...textStyle(textRoles.menuRow),
    color: theme.color.text,
    flexGrow: 1,
    flexShrink: 1,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: stemPlayer.menuRowMinHeight,
    borderTopWidth: size.stroke,
    borderTopColor: theme.color.line,
  },
  value: {
    ...textStyle(textRoles.menuValue),
    color: theme.color.text2,
    flexShrink: 1,
    textAlign: 'right',
  },
  toggleBody: { flexGrow: 1, flexShrink: 1 },
  valueBelow: { ...textStyle(textRoles.menuValue), color: theme.color.text2 },
}));

function PlayerSpeedGroup() {
  const { speed, step } = usePlayerSpeedStep();
  const setSpeed = useStemPlayer((s) => s.setSpeed);
  const hint = useStemPlayer((s) => speedHint(s.recordedFacts, s.facts));
  const presets = useMemo(() => speedPresetTexts(speed), [speed]);
  const pick = useCallback(
    (picked: number) => {
      void setSpeed(picked);
    },
    [setSpeed],
  );
  return (
    <SpeedGroup
      label={speedKeyCopy.speed}
      value={speedPercentText(speed)}
      accented={!isUnitySpeed(speed)}
      presets={presets}
      hint={hint}
      onStep={step}
      onPick={pick}
    />
  );
}

function KeyGroup() {
  const hint = useStemPlayer((s) =>
    keyHint(s.recordedFacts, s.facts, s.songKey),
  );
  return (
    <>
      <StepperRow label={speedKeyCopy.key}>
        <SongKeyStepper gaps={SHEET_STEPPER_GAPS} />
      </StepperRow>
      <SheetHint>{hint}</SheetHint>
    </>
  );
}

function PerStemKeys() {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const scaled = useTextScaled();
  const summary = useStemPlayer((s) => perStemSummary(s.stems, s.songKey));
  const toggle = useCallback(() => {
    setOpen((was) => !was);
  }, []);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${speedKeyCopy.perStem}, ${summary}`}
        accessibilityState={{ expanded: open }}
        style={styles.toggle}
        onPress={toggle}
      >
        {scaled ? (
          <View testID={PER_STEM_STACKED_ID} style={styles.toggleBody}>
            <Text style={styles.label}>{speedKeyCopy.perStem}</Text>
            <Text style={styles.valueBelow}>{summary}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>{speedKeyCopy.perStem}</Text>
            <Text style={styles.value}>{summary}</Text>
          </>
        )}
        <Icon
          name={open ? 'caretUp' : 'caretDown'}
          size="title"
          color="text2"
        />
      </Pressable>
      {open ? <StemKeyRows /> : null}
    </>
  );
}

export interface SpeedKeySheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

export function SpeedKeySheet({
  visible,
  bottomInset,
  onClose,
}: SpeedKeySheetProps) {
  return (
    <Sheet
      visible={visible}
      title={speedKeyCopy.title}
      dismissLabel={speedKeyCopy.close}
      bottomInset={bottomInset}
      onDismiss={onClose}
    >
      <PlayerSpeedGroup />
      <KeyGroup />
      <PerStemKeys />
    </Sheet>
  );
}
