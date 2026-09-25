import { PresetButton, space } from '@kitbag/core-design';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

const FINE_NUDGE = 5;
const COARSE_NUDGE = 10;
const NUDGES = [-COARSE_NUDGE, -FINE_NUDGE, FINE_NUDGE, COARSE_NUDGE] as const;
const TAP_INSERT_INDEX = NUDGES.length / 2;

interface NudgeKeyProps {
  readonly delta: number;
  readonly onNudge: (delta: number) => void;
}

function NudgeKey({ delta, onNudge }: NudgeKeyProps) {
  const handlePress = useCallback(() => {
    onNudge(delta);
  }, [onNudge, delta]);

  const label = delta > 0 ? `+${String(delta)}` : `−${String(-delta)}`;
  const spoken = `${delta > 0 ? 'Up' : 'Down'} ${String(Math.abs(delta))} BPM`;

  return (
    <PresetButton
      label={label}
      accessibilityLabel={spoken}
      onPress={handlePress}
    />
  );
}

interface PresetRowProps {
  readonly onNudge: (delta: number) => void;
  readonly onTap: () => void;
}

export function PresetRow({ onNudge, onTap }: PresetRowProps) {
  return (
    <View style={styles.row}>
      {NUDGES.slice(0, TAP_INSERT_INDEX).map((delta) => (
        <NudgeKey key={delta} delta={delta} onNudge={onNudge} />
      ))}
      <PresetButton
        kind="action"
        label="TAP"
        accessibilityLabel="Tap tempo"
        onPress={onTap}
      />
      {NUDGES.slice(TAP_INSERT_INDEX).map((delta) => (
        <NudgeKey key={delta} delta={delta} onNudge={onNudge} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
});
