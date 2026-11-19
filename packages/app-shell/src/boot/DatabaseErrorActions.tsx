import { Button, databaseError, space } from '@kitbag/core-design';
import { StyleSheet, View } from 'react-native';

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
    <View style={[styles.actions, stacked && styles.stacked]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: space.controlGap,
    marginTop: databaseError.actionsTop,
  },
  stacked: { flexDirection: 'column' },
});
