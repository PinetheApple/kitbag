import {
  Button,
  createThemedStyles,
  EditCheckRow,
  EditGroup,
  EditValue,
  lineRatio,
  Sheet,
  textRoles,
  textStyle,
  toolsManager,
} from '@kitbag/core-design';
import type { ToolDataUsage } from '@kitbag/core-state';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatBytes } from './bytes.ts';
import {
  ALSO_DELETE_DATA,
  CANCEL,
  DELETED_FOREVER,
  REMOVE,
  REMOVE_AND_DELETE,
  removeBody,
  removeTitle,
} from './toolPageText.ts';
import { useToolScreenStyles } from './toolScreenStyles.ts';

const useStyles = createThemedStyles((theme) => ({
  warning: {
    ...textStyle(textRoles.sheetHint),
    lineHeight: textRoles.sheetHint.size * lineRatio.hint,
    color: theme.feedback.danger.ink,
    paddingHorizontal: toolsManager.introH,
  },
}));

export interface RemoveToolDialogProps {
  readonly visible: boolean;
  readonly name: string;
  readonly data: ToolDataUsage;
  readonly onConfirm: (deleteData: boolean) => void;
  readonly onCancel: () => void;
}

export function RemoveToolDialog({
  visible,
  name,
  data,
  onConfirm,
  onCancel,
}: RemoveToolDialogProps) {
  const styles = useToolScreenStyles();
  const own = useStyles();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (visible) setDeleting(false);
  }, [visible]);
  const toggle = useCallback(() => {
    setDeleting((value) => !value);
  }, []);
  const hasData = data.items > 0;
  const deletingData = hasData && deleting;
  const confirm = useCallback(() => {
    onConfirm(deletingData);
  }, [onConfirm, deletingData]);
  return (
    <Sheet
      visible={visible}
      title={removeTitle(name)}
      dismissLabel={CANCEL}
      bottomInset={insets.bottom}
      onDismiss={onCancel}
    >
      <Text style={styles.body}>{removeBody(data.items, deletingData)}</Text>
      {hasData ? (
        <EditGroup>
          <EditCheckRow
            label={ALSO_DELETE_DATA}
            checked={deleting}
            onToggle={toggle}
          >
            <EditValue muted>{formatBytes(data.bytes)}</EditValue>
          </EditCheckRow>
        </EditGroup>
      ) : null}
      {deletingData ? <Text style={own.warning}>{DELETED_FOREVER}</Text> : null}
      <View style={styles.actions}>
        <Button fill size="sheet" label={CANCEL} onPress={onCancel} />
        <Button
          fill
          size="sheet"
          variant="destructive"
          label={deletingData ? REMOVE_AND_DELETE : REMOVE}
          onPress={confirm}
        />
      </View>
    </Sheet>
  );
}
