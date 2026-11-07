import type { Conflict, Resolution, Resolutions } from '@kitbag/core-db';
import {
  Button,
  createThemedStyles,
  EditDivider,
  EditRow,
  SegmentedControl,
  Sheet,
  SheetHint,
  space,
  TextField,
  type SegmentOption,
} from '@kitbag/core-design';
import { isReplaceConfirmed, REPLACE_CONFIRMATION } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  conflictDetail,
  KEEP_MINE,
  REPLACE_TITLE,
  REVIEW_TITLE,
  TAKE_THEIRS,
} from './backupText.ts';
import { CLOSE } from './settingsLabels.ts';

const RESOLUTION_OPTIONS: readonly SegmentOption<Resolution>[] = [
  { value: 'mine', label: KEEP_MINE },
  { value: 'theirs', label: TAKE_THEIRS },
];

const useStyles = createThemedStyles(() => ({
  stack: { gap: space.controlGap },
}));

function ConflictRow({
  conflict,
  resolution,
  onResolve,
}: {
  readonly conflict: Conflict;
  readonly resolution: Resolution | undefined;
  readonly onResolve: (conflict: Conflict, resolution: Resolution) => void;
}) {
  const select = useCallback(
    (value: Resolution) => {
      onResolve(conflict, value);
    },
    [conflict, onResolve],
  );
  return (
    <View>
      <EditRow label={`${conflict.label} · ${conflictDetail(conflict)}`}>
        <SegmentedControl
          compact
          size="inline"
          accessibilityLabel={`${conflict.label}: keep mine or take theirs`}
          options={RESOLUTION_OPTIONS}
          selected={resolution}
          onSelect={select}
        />
      </EditRow>
      <EditDivider />
    </View>
  );
}

export interface ConflictSheetProps {
  readonly visible: boolean;
  readonly conflicts: readonly Conflict[];
  readonly resolutions: Resolutions;
  readonly onResolve: (conflict: Conflict, resolution: Resolution) => void;
  readonly onDismiss: () => void;
}

export function ConflictSheet(props: ConflictSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Sheet
      visible={props.visible}
      title={REVIEW_TITLE}
      dismissLabel={CLOSE}
      bottomInset={insets.bottom}
      scrollEnabled
      onDismiss={props.onDismiss}
    >
      {props.conflicts.map((conflict) => (
        <ConflictRow
          key={`${conflict.category}:${conflict.key}`}
          conflict={conflict}
          resolution={props.resolutions[conflict.category]?.[conflict.key]}
          onResolve={props.onResolve}
        />
      ))}
    </Sheet>
  );
}

export interface ReplaceSheetProps {
  readonly visible: boolean;
  readonly body: string;
  readonly confirmLabel: string;
  readonly onConfirm: (typed: string) => void;
  readonly onDismiss: () => void;
}

export function ReplaceSheet(props: ReplaceSheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [typed, setTyped] = useState('');
  const { onConfirm, onDismiss } = props;
  const confirm = useCallback(() => {
    onConfirm(typed);
    setTyped('');
  }, [onConfirm, typed]);
  const dismiss = useCallback(() => {
    setTyped('');
    onDismiss();
  }, [onDismiss]);
  return (
    <Sheet
      visible={props.visible}
      title={REPLACE_TITLE}
      dismissLabel={CLOSE}
      bottomInset={insets.bottom}
      onDismiss={dismiss}
    >
      <View style={styles.stack}>
        <SheetHint>{props.body}</SheetHint>
        <TextField
          value={typed}
          onChangeText={setTyped}
          placeholder={REPLACE_CONFIRMATION}
          accessibilityLabel={`Type ${REPLACE_CONFIRMATION} to confirm`}
          autoFocus
        />
        <Button
          label={props.confirmLabel}
          variant="destructive"
          size="sheet"
          disabled={!isReplaceConfirmed(typed)}
          onPress={confirm}
        />
      </View>
    </Sheet>
  );
}
