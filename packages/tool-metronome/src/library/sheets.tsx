import {
  Button,
  createThemedStyles,
  Sheet,
  SheetHint,
  space,
  TextField,
  type ButtonVariant,
} from '@kitbag/core-design';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

const useStyles = createThemedStyles(() => ({
  stack: { gap: space.controlGap },
  row: { flexDirection: 'row', gap: space.controlGap },
}));

export type Handler = () => unknown;

export function useFire(handler: Handler): () => void {
  return useCallback(() => {
    void Promise.resolve(handler());
  }, [handler]);
}

export interface SheetAction {
  readonly label: string;
  readonly onPress: Handler;
  readonly variant?: ButtonVariant;
}

interface BaseSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
  readonly error?: string | null;
}

function ActionButton({ action }: { readonly action: SheetAction }) {
  const press = useFire(action.onPress);
  return (
    <Button
      label={action.label}
      variant={action.variant ?? 'tonal'}
      onPress={press}
    />
  );
}

export function ActionsSheet(
  props: BaseSheetProps & {
    readonly actions: readonly SheetAction[];
    readonly hint?: string | undefined;
  },
) {
  const styles = useStyles();
  return (
    <Sheet
      visible={props.visible}
      title={props.title}
      dismissLabel={`Close ${props.title}`}
      bottomInset={props.bottomInset}
      onDismiss={props.onDismiss}
    >
      <View style={styles.stack}>
        {props.actions.map((action) => (
          <ActionButton key={action.label} action={action} />
        ))}
      </View>
      {props.error == null ? null : <SheetHint>{props.error}</SheetHint>}
      {props.hint === undefined ? null : <SheetHint>{props.hint}</SheetHint>}
    </Sheet>
  );
}

export interface ConfirmSheetProps extends BaseSheetProps {
  readonly body: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly onConfirm: Handler;
}

export function ConfirmSheet(props: ConfirmSheetProps) {
  const styles = useStyles();
  const confirm = useFire(props.onConfirm);
  return (
    <Sheet
      visible={props.visible}
      title={props.title}
      dismissLabel={`Close ${props.title}`}
      bottomInset={props.bottomInset}
      onDismiss={props.onDismiss}
    >
      <SheetHint>{props.body}</SheetHint>
      {props.error == null ? null : <SheetHint>{props.error}</SheetHint>}
      <View style={styles.row}>
        <Button fill variant="ghost" label="Cancel" onPress={props.onDismiss} />
        <Button
          fill
          variant={props.destructive === true ? 'destructive' : 'primary'}
          label={props.confirmLabel}
          onPress={confirm}
        />
      </View>
    </Sheet>
  );
}

export interface NameSheetProps extends BaseSheetProps {
  readonly initial: string;
  readonly confirmLabel: string;
  readonly onSubmit: (name: string) => void | Promise<void>;
}

function useNameDraft(
  initial: string,
  onSubmit: (name: string) => void | Promise<void>,
) {
  const [name, setName] = useState(initial);
  const reset = useCallback(() => {
    setName(initial);
  }, [initial]);
  const submit = useCallback(() => {
    if (name.trim() !== '') void Promise.resolve(onSubmit(name.trim()));
  }, [name, onSubmit]);
  return { name, setName, reset, submit };
}

export function NameSheet(props: NameSheetProps) {
  const draft = useNameDraft(props.initial, props.onSubmit);
  return (
    <Sheet
      visible={props.visible}
      title={props.title}
      dismissLabel={`Close ${props.title}`}
      bottomInset={props.bottomInset}
      onShow={draft.reset}
      onDismiss={props.onDismiss}
    >
      <TextField
        autoFocus
        value={draft.name}
        onChangeText={draft.setName}
        placeholder="Name"
        accessibilityLabel="Name"
        onSubmitEditing={draft.submit}
      />
      {props.error == null ? null : <SheetHint>{props.error}</SheetHint>}
      <Button
        variant="primary"
        label={props.confirmLabel}
        disabled={draft.name.trim() === ''}
        onPress={draft.submit}
      />
    </Sheet>
  );
}
