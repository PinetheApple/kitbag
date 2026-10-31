import {
  Button,
  Chip,
  createThemedStyles,
  EditDivider,
  EditPath,
  EditRow,
  EditValue,
  Sheet,
  SheetHint,
  space,
} from '@kitbag/core-design';
import type { StorageReport } from '@kitbag/core-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  showsRemoveMissing,
  type StorageSheetKind,
} from './storageSheetFlow.ts';
import {
  databaseText,
  libraryAudioText,
  REMOVAL_FAILED,
  removeMissingLabel,
  removeMissingTitle,
  stemSetsText,
  STORAGE_LABEL,
} from './storageText.ts';

const useStyles = createThemedStyles(() => ({
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

function SheetRow({
  label,
  singleLine = false,
  children,
}: {
  readonly label: string;
  readonly singleLine?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <View>
      <EditRow label={label} singleLine={singleLine}>
        {children}
      </EditRow>
      <EditDivider />
    </View>
  );
}

function StorageRows({ report }: { readonly report: StorageReport }) {
  return (
    <>
      <SheetRow label="Library audio">
        <EditValue>{libraryAudioText(report)}</EditValue>
      </SheetRow>
      <SheetRow label="Stem sets">
        <EditValue>{stemSetsText(report)}</EditValue>
      </SheetRow>
      <SheetRow label="Database">
        <EditValue>{databaseText(report)}</EditValue>
      </SheetRow>
      {report.location === '' ? null : (
        <SheetRow label="Location" singleLine>
          <EditPath>{report.location}</EditPath>
        </SheetRow>
      )}
    </>
  );
}

export interface StorageSheetsProps {
  readonly kind: StorageSheetKind;
  readonly report: StorageReport | null;
  readonly missingCount: number;
  readonly removalFailed: boolean;
  readonly onShow: () => void;
  readonly onAskRemove: () => void;
  readonly onRemove: () => void;
  readonly onCancelRemove: () => void;
  readonly onDismiss: () => void;
}

function ConfirmRemoveSheet({
  visible,
  count,
  onRemove,
  onCancel,
}: {
  readonly visible: boolean;
  readonly count: number;
  readonly onRemove: () => void;
  readonly onCancel: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Sheet
      visible={visible}
      title={removeMissingTitle(count)}
      dismissLabel="Keep them"
      bottomInset={insets.bottom}
      onDismiss={onCancel}
    >
      <SheetHint>
        Their audio is no longer on this phone, so they are taken out of your
        library. Song presets that used them keep their settings. This cannot be
        undone.
      </SheetHint>
      <View style={styles.actions}>
        <Button fill variant="ghost" label="Cancel" onPress={onCancel} />
        <Button fill variant="destructive" label="Remove" onPress={onRemove} />
      </View>
    </Sheet>
  );
}

export function StorageSheets({
  kind,
  report,
  missingCount,
  removalFailed,
  onShow,
  onAskRemove,
  onRemove,
  onCancelRemove,
  onDismiss,
}: StorageSheetsProps) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <Sheet
        visible={kind === 'storage'}
        title={STORAGE_LABEL}
        titleIcon="storage"
        dismissLabel="Close storage"
        bottomInset={insets.bottom}
        onShow={onShow}
        onDismiss={onDismiss}
      >
        {report === null ? null : <StorageRows report={report} />}
        {removalFailed ? <SheetHint>{REMOVAL_FAILED}</SheetHint> : null}
        {showsRemoveMissing(missingCount) ? (
          <Chip
            icon="removeMissing"
            label={removeMissingLabel(missingCount)}
            onPress={onAskRemove}
          />
        ) : null}
        <SheetHint>Reports, doesn’t relocate.</SheetHint>
      </Sheet>
      <ConfirmRemoveSheet
        visible={kind === 'confirm'}
        count={missingCount}
        onRemove={onRemove}
        onCancel={onCancelRemove}
      />
    </>
  );
}
