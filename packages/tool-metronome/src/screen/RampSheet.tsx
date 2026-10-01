import {
  Button,
  Chip,
  createThemedStyles,
  SegmentedControl,
  Sheet,
  space,
  StepControl,
  textRoles,
  textStyle,
  type StepDelta,
} from '@kitbag/core-design';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import {
  RAMP_UNIT_OPTIONS,
  rampUnitFromOption,
  rampUnitLabel,
  rampUnitOption,
} from '../logic/rampUnit.ts';
import { useRampEditor, type RampEditor } from './useRampEditor.ts';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.controlGap,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
  },
  label: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text2,
  },
  actions: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
}));
interface RampFieldProps {
  readonly label: string;
  readonly spokenLabel: string;
  readonly value: number;
  readonly unit: string;
  readonly onStep: (delta: StepDelta) => void;
  readonly trailing?: string;
}

function RampField({
  label,
  spokenLabel,
  value,
  unit,
  onStep,
  trailing,
}: RampFieldProps) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <StepControl
        variant="inline"
        label={spokenLabel}
        value={String(value)}
        accessibilityValue={`${String(value)} ${unit}`}
        onStep={onStep}
      />
      {trailing === undefined ? null : (
        <Text style={styles.label}>{trailing}</Text>
      )}
    </View>
  );
}

function TempoFields({ editor }: { readonly editor: RampEditor }) {
  const styles = useStyles();
  const { draft } = editor;
  return (
    <View style={styles.row}>
      <RampField
        label="From"
        spokenLabel="Ramp from"
        value={draft.startBpm}
        unit="BPM"
        onStep={editor.stepFrom}
      />
      <RampField
        label="To"
        spokenLabel="Ramp to"
        value={draft.endBpm}
        unit="BPM"
        onStep={editor.stepTo}
      />
    </View>
  );
}
function DurationField({ editor }: { readonly editor: RampEditor }) {
  const styles = useStyles();
  const { setUnit } = editor;
  const handleUnitSelect = useCallback(
    (option: string) => {
      setUnit(rampUnitFromOption(option));
    },
    [setUnit],
  );
  return (
    <View style={styles.row}>
      <RampField
        label="Over"
        spokenLabel="Ramp length"
        value={editor.draft.duration}
        unit={rampUnitLabel(editor.draft.unit)}
        onStep={editor.stepDuration}
      />
      <SegmentedControl
        fill
        accessibilityLabel="Ramp length unit"
        options={RAMP_UNIT_OPTIONS}
        selected={rampUnitOption(editor.draft.unit)}
        onSelect={handleUnitSelect}
      />
    </View>
  );
}

function RampActions({ editor }: { readonly editor: RampEditor }) {
  const styles = useStyles();
  return (
    <View style={styles.actions}>
      <Button
        fill
        variant="ghost"
        label="Clear"
        disabled={!editor.running}
        onPress={editor.clear}
      />
      <Button
        fill
        variant="primary"
        label={editor.running ? 'Restart ramp' : 'Start ramp'}
        disabled={editor.draft.startBpm === editor.draft.endBpm}
        onPress={editor.start}
      />
    </View>
  );
}
function LoopControl({ editor }: { readonly editor: RampEditor }) {
  return (
    <Chip
      icon="reset"
      active={editor.draft.loop}
      label="Loop back at end"
      accessibilityLabel={`Loop back at end, ${editor.draft.loop ? 'on' : 'off'}`}
      onPress={editor.toggleLoop}
    />
  );
}

interface RampSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function RampSheet({ visible, bottomInset, onDismiss }: RampSheetProps) {
  const editor = useRampEditor(onDismiss);
  return (
    <Sheet
      visible={visible}
      title="Tempo ramp"
      titleIcon="ramp"
      hint="Changing tempo by hand cancels a running ramp — the chip clears with it."
      dismissLabel="Close tempo ramp"
      bottomInset={bottomInset}
      onShow={editor.reset}
      onDismiss={onDismiss}
    >
      <TempoFields editor={editor} />
      <DurationField editor={editor} />
      <LoopControl editor={editor} />
      <RampActions editor={editor} />
    </Sheet>
  );
}
