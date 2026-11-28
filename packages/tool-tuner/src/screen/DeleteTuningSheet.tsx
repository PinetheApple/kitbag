import {
  Button,
  createThemedStyles,
  Sheet,
  SheetHint,
  space,
} from '@kitbag/core-design';
import { View } from 'react-native';

import { deleteTuningText, deleteTuningTitle } from '../logic/tunings.ts';

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', gap: space.controlGap },
}));

export interface DeleteTuningSheetProps {
  readonly visible: boolean;
  readonly name: string;
  readonly stringCount: number;
  readonly bottomInset: number;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
}

export function DeleteTuningSheet({
  visible,
  name,
  stringCount,
  bottomInset,
  onCancel,
  onDelete,
}: DeleteTuningSheetProps) {
  const styles = useStyles();
  return (
    <Sheet
      visible={visible}
      title={deleteTuningTitle(name)}
      dismissLabel="Cancel delete"
      bottomInset={bottomInset}
      onDismiss={onCancel}
    >
      <SheetHint>{deleteTuningText(stringCount)}</SheetHint>
      <View style={styles.row}>
        <Button fill variant="ghost" label="Cancel" onPress={onCancel} />
        <Button fill variant="destructive" label="Delete" onPress={onDelete} />
      </View>
    </Sheet>
  );
}
