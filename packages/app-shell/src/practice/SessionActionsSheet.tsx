import { Button, createThemedStyles, Sheet, space } from '@kitbag/core-design';
import type { PracticeSessionListing } from '@kitbag/core-db';
import { useCallback } from 'react';
import { View } from 'react-native';

const useStyles = createThemedStyles(() => ({
  stack: { gap: space.controlGap },
}));

export interface SessionActionsSheetProps {
  readonly target: PracticeSessionListing | null;
  readonly title: string;
  readonly bottomInset: number;
  readonly onOpen: (uuid: string) => void;
  readonly onDelete: (session: PracticeSessionListing) => void;
  readonly onDismiss: () => void;
}

export function SessionActionsSheet({
  target,
  title,
  bottomInset,
  onOpen,
  onDelete,
  onDismiss,
}: SessionActionsSheetProps) {
  const styles = useStyles();
  const open = useCallback(() => {
    onDismiss();
    if (target !== null) onOpen(target.uuid);
  }, [onDismiss, onOpen, target]);
  const remove = useCallback(() => {
    onDismiss();
    if (target !== null) onDelete(target);
  }, [onDismiss, onDelete, target]);
  return (
    <Sheet
      visible={target !== null}
      title={title}
      dismissLabel={`Close ${title}`}
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <View style={styles.stack}>
        <Button label="Open" icon="forward" variant="tonal" onPress={open} />
        <Button
          label="Delete session"
          icon="delete"
          variant="destructive"
          onPress={remove}
        />
      </View>
    </Sheet>
  );
}
