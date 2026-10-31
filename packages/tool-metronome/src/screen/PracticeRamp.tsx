import {
  Chip,
  metronomeSheet,
  SegmentedControl,
  SheetHint,
  space,
  StepControl,
  Switch,
  unshared,
} from '@kitbag/core-design';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import type { PracticeField } from '../logic/practiceEntry.ts';
import { rampStepSpoken, rampStepText } from '../logic/rampStep.ts';
import {
  RAMP_UNIT_OPTIONS,
  rampUnitFromOption,
  rampUnitLabel,
  rampUnitOption,
} from '../logic/rampUnit.ts';
import { PracticeSection, usePracticeStyles } from './PracticeSection.tsx';
import { useRampEditor, type RampEditor } from './useRampEditor.ts';

const bpm = (value: number) => `${String(value)} BPM`;

interface RowsProps {
  readonly editor: RampEditor;
  readonly onType: (field: PracticeField) => void;
}

function TempoRow({ editor, onType }: RowsProps) {
  const styles = usePracticeStyles();
  const { startBpm, targetBpm } = editor.ramp;
  const handleTypeFrom = useCallback(() => {
    onType('startBpm');
  }, [onType]);
  const handleTypeTo = useCallback(() => {
    onType('targetBpm');
  }, [onType]);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>From</Text>
      <StepControl
        variant="inlineLarge"
        label="Ramp from"
        value={String(startBpm)}
        accessibilityValue={bpm(startBpm)}
        neighbourGapDp={space.controlGap}
        onStep={editor.stepFrom}
        onValuePress={handleTypeFrom}
      />
      <View style={styles.grow} />
      <Text style={styles.label}>To</Text>
      <StepControl
        variant="inlineLarge"
        label="Ramp to"
        value={String(targetBpm)}
        accessibilityValue={bpm(targetBpm)}
        neighbourGapDp={space.controlGap}
        onStep={editor.stepTo}
        onValuePress={handleTypeTo}
      />
    </View>
  );
}

function CadenceRows({ editor, onType }: RowsProps) {
  const styles = usePracticeStyles();
  const { stepBpm, startBpm, targetBpm, interval, unit } = editor.ramp;
  const { setUnit } = editor;
  const handleTypeStep = useCallback(() => {
    onType('stepBpm');
  }, [onType]);
  const handleTypeInterval = useCallback(() => {
    onType('interval');
  }, [onType]);
  const handleUnit = useCallback(
    (option: string) => {
      setUnit(rampUnitFromOption(option));
    },
    [setUnit],
  );
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.label}>Step</Text>
        <StepControl
          variant="inlineLarge"
          label="Ramp step"
          value={rampStepText(stepBpm, startBpm, targetBpm)}
          accessibilityValue={rampStepSpoken(stepBpm, startBpm, targetBpm)}
          neighbourGapDp={space.controlGap}
          onStep={editor.stepStepSize}
          onValuePress={handleTypeStep}
        />
        <View style={styles.grow} />
        <SheetHint size="large">BPM per step</SheetHint>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Every</Text>
        <StepControl
          variant="inlineLarge"
          label="Ramp every"
          value={String(interval)}
          accessibilityValue={`${String(interval)} ${rampUnitLabel(unit)}`}
          neighbourGapDp={space.controlGap}
          onStep={editor.stepInterval}
          onValuePress={handleTypeInterval}
        />
        <SegmentedControl
          fill
          size="large"
          accessibilityLabel="Ramp interval unit"
          options={RAMP_UNIT_OPTIONS}
          selected={rampUnitOption(unit)}
          neighbourGapDp={space.controlGap}
          onSelect={handleUnit}
        />
      </View>
    </>
  );
}

interface PracticeRampProps {
  readonly onType: (field: PracticeField) => void;
}

export function PracticeRamp({ onType }: PracticeRampProps) {
  const styles = usePracticeStyles();
  const editor = useRampEditor();
  const { loop, enabled } = editor.ramp;
  return (
    <PracticeSection
      icon="ramp"
      title="Tempo ramp"
      heading={
        <>
          <View style={styles.grow} />
          <Switch
            neighbourGapDp={{
              top: unshared(metronomeSheet.practiceSectionV),
              bottom: space.controlGap,
              right: 0,
            }}
            accessibilityLabel="Tempo ramp"
            value={enabled}
            onValueChange={editor.toggle}
          />
        </>
      }
    >
      <TempoRow editor={editor} onType={onType} />
      <CadenceRows editor={editor} onType={onType} />
      <View style={styles.row}>
        <Chip
          size="large"
          icon="repeat"
          active={loop}
          label="Loop back at end"
          accessibilityLabel={`Loop back at end, ${loop ? 'on' : 'off'}`}
          neighbourGapDp={space.controlGap}
          onPress={editor.toggleLoop}
        />
        <View style={styles.grow} />
        <SheetHint size="large">tap a number to type it</SheetHint>
      </View>
    </PracticeSection>
  );
}
