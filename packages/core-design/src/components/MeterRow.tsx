import { meterRowValue } from '../meterText.ts';
import { MenuRow } from './MenuRow.tsx';

export interface MeterRowProps {
  readonly value: number;
  readonly yours: boolean;
  readonly disabled?: boolean;
  readonly reason?: string;
  readonly onPress: () => void;
}

export function MeterRow({
  value,
  yours,
  disabled = false,
  reason,
  onPress,
}: MeterRowProps) {
  return (
    <MenuRow
      icon="metronome"
      label="Meter"
      detail={disabled ? reason : undefined}
      value={disabled ? undefined : meterRowValue(value, yours)}
      disabled={disabled}
      onPress={onPress}
    />
  );
}
