import { TimeSignatureSheet } from '@kitbag/core-design';
import { KB_DENOMINATORS, KB_MAX_BEATS } from '@kitbag/core-native';
import { useMetronome } from '@kitbag/core-state';

interface MeterSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function MeterSheet({
  visible,
  bottomInset,
  onDismiss,
}: MeterSheetProps) {
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  const denominator = useMetronome((s) => s.denominator);
  const setBeats = useMetronome((s) => s.setBeats);
  return (
    <TimeSignatureSheet
      visible={visible}
      bottomInset={bottomInset}
      beatsPerBar={beatsPerBar}
      denominator={denominator}
      maxBeats={KB_MAX_BEATS}
      denominators={KB_DENOMINATORS}
      onSet={setBeats}
      onDismiss={onDismiss}
    />
  );
}
