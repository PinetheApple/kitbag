import {
  Chip,
  SegmentedControl,
  SheetHint,
  space,
  StepControl,
  Switch,
} from '@kitbag/core-design';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import type { RampBpmField } from '../logic/rampEntry.ts';
import {
  RAMP_UNIT_OPTIONS,
  rampUnitFromOption,
  rampUnitLabel,
  rampUnitOption,
} from '../logic/rampUnit.ts';
import { PracticeSection, usePracticeStyles } from './PracticeSection.tsx';
import { useRampEditor, type RampEditor } from './useRampEditor.ts';

const bpm = (value: number) => `${String(value)} BPM`;

interface TempoRowProps {
  readonly editor: RampEditor;
  readonly onTypeBpm: (field: RampBpmField) => void;
}

function TempoRow({ editor, onTypeBpm }: TempoRowProps) {
  const styles = usePracticeStyles();
  const { startBpm, targetBpm } = editor.ramp;
  const handleTypeFrom = useCallback(() => {
    onTypeBpm('startBpm');
  }, [onTypeBpm]);
  const handleTypeTo = useCallback(() => {
    onTypeBpm('targetBpm');
  }, [onTypeBpm]);
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

function CadenceRows({ editor }: { readonly editor: RampEditor }) {
  const styles = usePracticeStyles();
  const { stepBpm, interval, unit } = editor.ramp;
  const { setUnit } = editor;
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
          value={`+${String(stepBpm)}`}
          accessibilityValue={`${bpm(stepBpm)} per step`}
          neighbourGapDp={space.controlGap}
          onStep={editor.stepStepSize}
        />
        <View style={styles.grow} />
        <SheetHint size="large">BPM per step</SheetHint>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Every</Text>
        <StepControl
          variant="inlineLarge"
          label="Ramp interval"
          value={String(interval)}
          accessibilityValue={`${String(interval)} ${rampUnitLabel(unit)}`}
          neighbourGapDp={space.controlGap}
          onStep={editor.stepInterval}
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
  readonly onTypeBpm: (field: RampBpmField) => void;
}

export function PracticeRamp({ onTypeBpm }: PracticeRampProps) {
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
            accessibilityLabel="Tempo ramp"
            value={enabled}
            onValueChange={editor.toggle}
          />
        </>
      }
    >
      <TempoRow editor={editor} onTypeBpm={onTypeBpm} />
      <CadenceRows editor={editor} />
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
