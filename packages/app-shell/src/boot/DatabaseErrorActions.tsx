import { Button, databaseError, space } from '@kitbag/core-design';
import { StyleSheet, View } from 'react-native';

import { DATABASE_ERROR_TEXT } from './databaseErrorCopy.ts';

export interface DatabaseErrorActionsProps {
  readonly stacked: boolean;
  readonly retrying: boolean;
  readonly onRetry: () => void;
  readonly onSaveCopy: () => void;
}

export function DatabaseErrorActions({
  stacked,
  retrying,
  onRetry,
  onSaveCopy,
}: DatabaseErrorActionsProps) {
  return (
    <View style={[styles.actions, stacked && styles.stacked]}>
      <Button
        variant="primary"
        size="target"
        icon="analyzing"
        iconSize="emptyButton"
        label={DATABASE_ERROR_TEXT.retry}
        disabled={retrying}
        fill={!stacked}
        onPress={onRetry}
      />
      <Button
        variant="tonal"
        size="target"
        icon="backupFile"
        iconSize="emptyButton"
        label={DATABASE_ERROR_TEXT.saveCopy}
        disabled={retrying}
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
