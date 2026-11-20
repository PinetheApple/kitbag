import {
  EDIT_ROW_PRESSABLE_GAP,
  EditGroup,
  EditRow,
  EditSwitchRow,
  EditValue,
  ListRow,
  rowLabel,
  SectionHeader,
  SegmentedControl,
  Snackbar,
  snackbar,
  type SegmentOption,
} from '@kitbag/core-design';
import { backupFilesAvailable, getAppVersion } from '@kitbag/core-native';
import { useAppearance, useTools, type ThemeChoice } from '@kitbag/core-state';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  LICENCE_NAME,
  LICENCE_URL,
  SOURCE_LABEL,
  SOURCE_URL,
} from './about.ts';
import { formatAppVersion } from './appVersion.ts';
import { BackUpRow, RestoreRow } from './BackupRows.tsx';
import { DataFolderRow, ReturnedCardRow } from './DataFolderRow.tsx';
import { DataFolderSheets } from './DataFolderSheets.tsx';
import { mediaSize } from './dataFolderText.ts';
import {
  NOTIFICATIONS_LABEL,
  type NotificationRow,
} from './notificationText.ts';
import { formatPracticeSummary } from './practiceText.ts';
import { RigSection } from './RigSection.tsx';
import { SettingsFrame } from './SettingsFrame.tsx';
import { StorageSheets } from './StorageSheet.tsx';
import { SwipeDirectionRow } from './SwipeDirectionRow.tsx';
import {
  nextStorageSheet,
  type StorageSheetEvent,
} from './storageSheetFlow.ts';
import { STORAGE_LABEL, storageSummary } from './storageText.ts';
import { usePracticeStats } from './usePracticeStats.ts';
import { TOOLS_TITLE, toolsOnSummary } from './toolsText.ts';
import { useNotificationRow } from './useNotificationRow.ts';
import { useDataFolderSheets } from './useDataFolderSheets.ts';
import { useStorage } from './useStorage.ts';

const THEME_OPTIONS: readonly SegmentOption<ThemeChoice>[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const THEME_CONTROL_GAPS = { bottom: EDIT_ROW_PRESSABLE_GAP };

const LICENCE_LABEL = 'Licence';

const SOURCE_ROW_LABEL = 'Source & issues';

function openUrl(url: string): void {
  Linking.openURL(url).catch((error: unknown) => {
    console.warn('[kitbag] could not open link', error);
  });
}

function PracticeValue() {
  const stats = usePracticeStats();
  if (stats === null) return null;
  const { lead, detail } = formatPracticeSummary(stats);
  if (lead === null) return <EditValue muted>{detail}</EditValue>;
  return (
    <EditValue>
      {`${lead} `}
      <EditValue muted>{detail}</EditValue>
    </EditValue>
  );
}

function ToolsSection({ onOpenTools }: { readonly onOpenTools: () => void }) {
  const summary = toolsOnSummary(useTools((s) => s.off));
  return (
    <>
      <SectionHeader label={TOOLS_TITLE} />
      <ListRow
        icon="settings"
        title={TOOLS_TITLE}
        subtitle={summary}
        accessibilityLabel={rowLabel(TOOLS_TITLE, summary)}
        onPress={onOpenTools}
      />
    </>
  );
}

function DataSection({
  openDataFolder,
  onOpenRestore,
  onOpenPractice,
  onNotice,
}: {
  readonly openDataFolder: boolean;
  readonly onOpenRestore: () => void;
  readonly onOpenPractice: () => void;
  readonly onNotice: (text: string) => void;
}) {
  const { report, missing, removalFailed, refresh, removeMissing } =
    useStorage();
  const dataFolder = useDataFolderSheets(onNotice);
  const openOnArrival = dataFolder.open;
  useEffect(() => {
    if (openDataFolder) openOnArrival();
  }, [openDataFolder, openOnArrival]);
  const summary = report === null ? null : storageSummary(report);
  const [sheet, send] = useReducer(nextStorageSheet, 'none');
  const handlers = useMemo(() => {
    const on = (event: StorageSheetEvent) => () => {
      send(event);
    };
    return {
      open: on('open'),
      askRemove: on('askRemove'),
      cancelRemove: on('cancelRemove'),
      dismiss: on('dismiss'),
    };
  }, []);
  const backups = backupFilesAvailable();
  const remove = useCallback(() => {
    send('remove');
    removeMissing();
  }, [removeMissing]);
  return (
    <>
      <SectionHeader label="Data" />
      <EditGroup>
        {backups && <BackUpRow />}
        {backups && <RestoreRow onOpenRestore={onOpenRestore} />}
        <EditRow label="Practice" onPress={onOpenPractice}>
          <PracticeValue />
        </EditRow>
        <DataFolderRow onOpen={dataFolder.open} />
        <ReturnedCardRow onOffer={dataFolder.offerReturn} />
        <EditRow
          label={STORAGE_LABEL}
          accessibilityLabel={
            summary === null ? STORAGE_LABEL : `${STORAGE_LABEL}, ${summary}`
          }
          onPress={handlers.open}
        >
          {summary === null ? null : <EditValue>{summary}</EditValue>}
        </EditRow>
      </EditGroup>
      <StorageSheets
        kind={sheet}
        report={report}
        missingCount={missing.length}
        removalFailed={removalFailed}
        onShow={refresh}
        onAskRemove={handlers.askRemove}
        onRemove={remove}
        onCancelRemove={handlers.cancelRemove}
        onDismiss={handlers.dismiss}
      />
      <DataFolderSheets
        model={dataFolder}
        media={report === null ? null : mediaSize(report)}
      />
    </>
  );
}

function NotificationsRow({
  row,
  onEnable,
}: {
  readonly row: NotificationRow;
  readonly onEnable: () => void;
}) {
  return (
    <EditRow
      label={NOTIFICATIONS_LABEL}
      accessibilityLabel={rowLabel(NOTIFICATIONS_LABEL, row.value ?? undefined)}
      onPress={row.action === 'none' ? undefined : onEnable}
    >
      {row.value === null ? null : <EditValue>{row.value}</EditValue>}
    </EditRow>
  );
}

function AppearanceSection() {
  const theme = useAppearance((s) => s.theme);
  const haptics = useAppearance((s) => s.haptics);
  const keepScreenAwake = useAppearance((s) => s.keepScreenAwake);
  const setTheme = useAppearance((s) => s.setTheme);
  const setHaptics = useAppearance((s) => s.setHaptics);
  const setKeepScreenAwake = useAppearance((s) => s.setKeepScreenAwake);
  const notifications = useNotificationRow();
  return (
    <>
      <SectionHeader label="Appearance" />
      <EditGroup>
        <EditRow label="Theme">
          <SegmentedControl
            compact
            size="inline"
            accessibilityLabel="Theme"
            options={THEME_OPTIONS}
            selected={theme}
            onSelect={setTheme}
            neighbourGapDp={THEME_CONTROL_GAPS}
          />
        </EditRow>
        <EditSwitchRow
          label="Haptics"
          value={haptics}
          onValueChange={setHaptics}
        />
        <EditSwitchRow
          label="Keep screen awake"
          value={keepScreenAwake}
          onValueChange={setKeepScreenAwake}
        />
        {notifications.row === null ? null : (
          <NotificationsRow
            row={notifications.row}
            onEnable={notifications.enable}
          />
        )}
        <SwipeDirectionRow gaps={THEME_CONTROL_GAPS} />
      </EditGroup>
    </>
  );
}

const SHOWS_APP_VERSION = Platform.OS !== 'web';

function VersionRow() {
  const version = useMemo(() => formatAppVersion(getAppVersion()), []);
  return (
    <EditRow label="Version">
      <EditValue muted>{version}</EditValue>
    </EditRow>
  );
}

function AboutSection({
  onOpenAttributions,
}: {
  readonly onOpenAttributions: () => void;
}) {
  const openLicence = useCallback(() => {
    openUrl(LICENCE_URL);
  }, []);
  const openSource = useCallback(() => {
    openUrl(SOURCE_URL);
  }, []);
  return (
    <>
      <SectionHeader label="About" />
      <EditGroup>
        {SHOWS_APP_VERSION && <VersionRow />}
        <EditRow
          label={LICENCE_LABEL}
          accessibilityRole="link"
          accessibilityLabel={`${LICENCE_LABEL}, ${LICENCE_NAME}`}
          onPress={openLicence}
        >
          <EditValue>{LICENCE_NAME}</EditValue>
        </EditRow>
        <EditRow
          label={SOURCE_ROW_LABEL}
          accessibilityRole="link"
          accessibilityLabel={`${SOURCE_ROW_LABEL}, ${SOURCE_URL}`}
          onPress={openSource}
        >
          <EditValue muted>{SOURCE_LABEL}</EditValue>
        </EditRow>
        <EditRow label="Attributions" onPress={onOpenAttributions} />
      </EditGroup>
    </>
  );
}

export interface SettingsScreenProps {
  readonly openDataFolder?: boolean;
  readonly onBack: () => void;
  readonly onOpenAttributions: () => void;
  readonly onOpenCalibration: () => void;
  readonly onOpenTools: () => void;
  readonly onOpenRestore: () => void;
  readonly onOpenPractice: () => void;
}

export function SettingsScreen({
  openDataFolder = false,
  onBack,
  onOpenAttributions,
  onOpenCalibration,
  onOpenTools,
  onOpenRestore,
  onOpenPractice,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);
  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);
  const overlay =
    notice === null ? null : (
      <Snackbar
        message={notice}
        bottom={insets.bottom + snackbar.aboveSheet}
        onTimeout={clearNotice}
      />
    );
  return (
    <SettingsFrame title="Settings" onBack={onBack} overlay={overlay}>
      <RigSection onOpenCalibration={onOpenCalibration} />
      <ToolsSection onOpenTools={onOpenTools} />
      <DataSection
        openDataFolder={openDataFolder}
        onOpenRestore={onOpenRestore}
        onOpenPractice={onOpenPractice}
        onNotice={setNotice}
      />
      <AppearanceSection />
      <AboutSection onOpenAttributions={onOpenAttributions} />
    </SettingsFrame>
  );
}
