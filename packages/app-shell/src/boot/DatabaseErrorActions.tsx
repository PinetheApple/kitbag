import { Button, ButtonRow, databaseError } from '@kitbag/core-design';
import { StyleSheet } from 'react-native';

import { DATABASE_ERROR_TEXT } from './databaseErrorCopy.ts';

export interface DatabaseErrorActionsProps {
  readonly stacked: boolean;
  readonly canRetry: boolean;
  readonly retrying: boolean;
  readonly saving: boolean;
  readonly onRetry: () => void;
  readonly onSaveCopy: () => void;
}

export function DatabaseErrorActions({
  stacked,
  canRetry,
  retrying,
  saving,
  onRetry,
  onSaveCopy,
}: DatabaseErrorActionsProps) {
  const busy = retrying || saving;
  return (
    <ButtonRow primaryAt="start" stacked={stacked} style={styles.actions}>
      {canRetry ? (
        <Button
          variant="primary"
          size="target"
          icon="analyzing"
          iconSize="emptyButton"
          label={DATABASE_ERROR_TEXT.retry}
          disabled={busy}
          fill={!stacked}
          onPress={onRetry}
        />
      ) : null}
      <Button
        variant="tonal"
        size="target"
        icon="backupFile"
        iconSize="emptyButton"
        label={DATABASE_ERROR_TEXT.saveCopy}
        disabled={busy}
        fill={!stacked}
        onPress={onSaveCopy}
      />
    </ButtonRow>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignSelf: 'stretch',
    marginTop: databaseError.actionsTop,
  },
});
