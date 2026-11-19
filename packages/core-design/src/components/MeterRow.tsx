import { meterCopy, meterRowValue } from '../meterText.ts';
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
  yours: overridden,
  disabled = false,
  reason,
  onPress,
}: MeterRowProps) {
  return (
    <MenuRow
      icon="metronome"
      label={meterCopy.title}
      detail={disabled ? reason : undefined}
      value={disabled ? undefined : meterRowValue(value, overridden)}
      disabled={disabled}
      onPress={onPress}
    />
  );
}
