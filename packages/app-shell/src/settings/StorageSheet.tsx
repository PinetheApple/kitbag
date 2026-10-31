import {
  EditDivider,
  EditPath,
  EditRow,
  EditValue,
  Sheet,
  SheetHint,
} from '@kitbag/core-design';
import type { StorageReport } from '@kitbag/core-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { databaseText, libraryAudioText, stemSetsText } from './storageText.ts';

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
      <SheetRow label="Location" singleLine>
        <EditPath>{report.location}</EditPath>
      </SheetRow>
    </>
  );
}

export interface StorageSheetProps {
  readonly visible: boolean;
  readonly report: StorageReport | null;
  readonly onShow: () => void;
  readonly onDismiss: () => void;
}

export function StorageSheet({
  visible,
  report,
  onShow,
  onDismiss,
}: StorageSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Sheet
      visible={visible}
      title="Storage"
      titleIcon="storage"
      dismissLabel="Close storage"
      bottomInset={insets.bottom}
      onShow={onShow}
      onDismiss={onDismiss}
    >
      {report === null ? null : <StorageRows report={report} />}
      <SheetHint>Reports, doesn’t relocate.</SheetHint>
    </Sheet>
  );
}
