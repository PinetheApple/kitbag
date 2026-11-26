import { SubdivisionSheet } from '@kitbag/core-design';
import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { useMetronome } from '@kitbag/core-state';

interface MetronomeSubdivisionSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function MetronomeSubdivisionSheet({
  visible,
  bottomInset,
  onDismiss,
}: MetronomeSubdivisionSheetProps) {
  const subdivision = useMetronome((s) => s.subdivision);
  const denominator = useMetronome((s) => s.denominator);
  const setSubdivision = useMetronome((s) => s.setSubdivision);
  return (
    <SubdivisionSheet
      visible={visible}
      bottomInset={bottomInset}
      subdivision={subdivision}
      denominator={denominator}
      bounds={KB_SUBDIVISION_BOUNDS}
      onPick={setSubdivision}
      onDismiss={onDismiss}
    />
  );
}
