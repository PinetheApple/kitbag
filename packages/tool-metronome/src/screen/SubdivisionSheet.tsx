import { SubdivisionSheet as SubdivisionPicker } from '@kitbag/core-design';
import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { useMetronome } from '@kitbag/core-state';

interface SubdivisionSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function SubdivisionSheet({
  visible,
  bottomInset,
  onDismiss,
}: SubdivisionSheetProps) {
  const subdivision = useMetronome((s) => s.subdivision);
  const denominator = useMetronome((s) => s.denominator);
  const setSubdivision = useMetronome((s) => s.setSubdivision);
  return (
    <SubdivisionPicker
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
