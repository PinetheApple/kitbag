import {
  Button,
  Card,
  createThemedStyles,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { Text, View } from 'react-native';

import { DONE_LABEL, UNDO_REPLACE_LABEL } from './backupText.ts';

const useStyles = createThemedStyles((theme) => ({
  banner: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
  note: { ...textStyle(textRoles.fieldLabel), color: theme.color.text3 },
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

function OutcomeActions({
  failed,
  actionLabel,
  onAction,
  onUndo,
}: {
  readonly failed: boolean;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly onUndo: (() => void) | null;
}) {
  const styles = useStyles();
  const action = (
    <Button
      fill={onUndo !== null}
      label={actionLabel}
      variant={failed ? 'tonal' : 'primary'}
      onPress={onAction}
    />
  );
  if (onUndo === null) return action;
  return (
    <View style={styles.actions}>
      <Button
        fill
        variant="ghost"
        label={UNDO_REPLACE_LABEL}
        onPress={onUndo}
      />
      {action}
    </View>
  );
}

export function Outcome({
  text,
  note,
  failed,
  actionLabel,
  onAction,
  onUndo,
}: {
  readonly text: string;
  readonly note: string | null;
  readonly failed: boolean;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly onUndo: (() => void) | null;
}) {
  const styles = useStyles();
  const body = (
    <>
      <Text style={styles.banner}>{text}</Text>
      {note === null ? null : <Text style={styles.note}>{note}</Text>}
    </>
  );
  return (
    <>
      {failed ? (
        <Card emphasis="danger" statusIcon="error" statusLabel="Failed">
          {body}
        </Card>
      ) : (
        <Card emphasis="success" statusIcon="success" statusLabel={DONE_LABEL}>
          {body}
        </Card>
      )}
      <OutcomeActions
        failed={failed}
        actionLabel={actionLabel}
        onAction={onAction}
        onUndo={onUndo}
      />
    </>
  );
}
