import {
  Button,
  createThemedStyles,
  Sheet,
  space,
  StepControl,
  textRoles,
  textStyle,
  type StepDelta,
} from '@kitbag/core-design';
import { KB_MAX_RAMP_BARS } from '@kitbag/core-native';
import { BPM_BOUNDS, useMetronome } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { barBounds, stepWithin } from '../logic/trainer.ts';

const RAMP_BARS = barBounds(KB_MAX_RAMP_BARS);

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

interface RampSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function RampSheet({ visible, bottomInset, onDismiss }: RampSheetProps) {
  const styles = useStyles();
  const ramp = useMetronome((s) => s.ramp);
  const setRamp = useMetronome((s) => s.setRamp);

  const handleFromStep = useCallback(
    (delta: StepDelta) => {
      setRamp({
        ...ramp,
        startBpm: stepWithin(ramp.startBpm, delta, BPM_BOUNDS),
      });
    },
    [ramp, setRamp],
  );
  const handleToStep = useCallback(
    (delta: StepDelta) => {
      setRamp({ ...ramp, endBpm: stepWithin(ramp.endBpm, delta, BPM_BOUNDS) });
    },
    [ramp, setRamp],
  );
  const handleBarsStep = useCallback(
    (delta: StepDelta) => {
      setRamp({ ...ramp, bars: stepWithin(ramp.bars, delta, RAMP_BARS) });
    },
    [ramp, setRamp],
  );
  const handleClear = useCallback(() => {
    setRamp({ ...ramp, enabled: false });
    onDismiss();
  }, [ramp, setRamp, onDismiss]);
  const handleStart = useCallback(() => {
    setRamp({ ...ramp, enabled: true });
    onDismiss();
  }, [ramp, setRamp, onDismiss]);

  return (
    <Sheet
      visible={visible}
      title="Tempo ramp"
      titleIcon="ramp"
      hint="Changing tempo by hand cancels a running ramp — the chip clears with it."
      dismissLabel="Close tempo ramp"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>From</Text>
          <StepControl
            variant="inline"
            label="Ramp from"
            value={String(ramp.startBpm)}
            accessibilityValue={`${String(ramp.startBpm)} BPM`}
            onStep={handleFromStep}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>To</Text>
          <StepControl
            variant="inline"
            label="Ramp to"
            value={String(ramp.endBpm)}
            accessibilityValue={`${String(ramp.endBpm)} BPM`}
            onStep={handleToStep}
          />
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Over</Text>
        <StepControl
          variant="inline"
          label="Ramp length"
          value={String(ramp.bars)}
          accessibilityValue={`${String(ramp.bars)} bars`}
          onStep={handleBarsStep}
        />
        <Text style={styles.label}>bars</Text>
      </View>
      <View style={styles.actions}>
        <Button
          fill
          variant="ghost"
          label="Clear"
          disabled={!ramp.enabled}
          onPress={handleClear}
        />
        <Button
          fill
          variant="primary"
          label="Start ramp"
          disabled={ramp.startBpm === ramp.endBpm}
          onPress={handleStart}
        />
      </View>
    </Sheet>
  );
}
