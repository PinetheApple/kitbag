import {
  Chip,
  createThemedStyles,
  EDIT_ROW_PRESSABLE_GAP,
  EditGroup,
  EditRow,
  EditSwitchRow,
  EditValue,
  inset,
  SectionHeader,
  SegmentedControl,
  type SegmentOption,
} from '@kitbag/core-design';
import { getAppVersion } from '@kitbag/core-native';
import { useAppearance, type ThemeChoice } from '@kitbag/core-state';
import { useCallback, useMemo, useReducer } from 'react';
import { Linking, Platform, View } from 'react-native';

import {
  LICENCE_NAME,
  LICENCE_URL,
  SOURCE_LABEL,
  SOURCE_URL,
} from './about.ts';
import { formatAppVersion } from './appVersion.ts';
import { formatPracticeSummary } from './practiceText.ts';
import { SettingsFrame } from './SettingsFrame.tsx';
import { CALIBRATE_LATENCY } from './settingsLabels.ts';
import { StorageSheets } from './StorageSheet.tsx';
import {
  nextStorageSheet,
  type StorageSheetEvent,
} from './storageSheetFlow.ts';
import { STORAGE_LABEL, storageSummary } from './storageText.ts';
import { usePracticeStats } from './usePracticeStats.ts';
import { useStorage } from './useStorage.ts';

const THEME_OPTIONS: readonly SegmentOption<ThemeChoice>[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const THEME_CONTROL_GAPS = { bottom: EDIT_ROW_PRESSABLE_GAP };

const LICENCE_LABEL = 'Licence';

const useStyles = createThemedStyles(() => ({
  chipRow: { flexDirection: 'row', paddingHorizontal: inset.sectionLabelH },
}));
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

function RigSection({
  onOpenCalibration,
}: {
  readonly onOpenCalibration: () => void;
}) {
  const styles = useStyles();
  return (
    <>
      <SectionHeader label="Rig" />
      <View style={styles.chipRow}>
        <Chip
          label={CALIBRATE_LATENCY}
          icon="calibrate"
          onPress={onOpenCalibration}
        />
      </View>
    </>
  );
}

function DataSection() {
  const { report, missing, removalFailed, refresh, removeMissing } =
    useStorage();
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
  const remove = useCallback(() => {
    send('remove');
    removeMissing();
  }, [removeMissing]);
  return (
    <>
      <SectionHeader label="Data" />
      <EditGroup>
        <EditRow label="Practice">
          <PracticeValue />
        </EditRow>
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
    </>
  );
}

function AppearanceSection() {
  const theme = useAppearance((s) => s.theme);
  const haptics = useAppearance((s) => s.haptics);
  const keepScreenAwake = useAppearance((s) => s.keepScreenAwake);
  const setTheme = useAppearance((s) => s.setTheme);
  const setHaptics = useAppearance((s) => s.setHaptics);
  const setKeepScreenAwake = useAppearance((s) => s.setKeepScreenAwake);
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
  readonly onBack: () => void;
  readonly onOpenAttributions: () => void;
  readonly onOpenCalibration: () => void;
}

export function SettingsScreen({
  onBack,
  onOpenAttributions,
  onOpenCalibration,
}: SettingsScreenProps) {
  return (
    <SettingsFrame title="Settings" onBack={onBack}>
      <RigSection onOpenCalibration={onOpenCalibration} />
      <DataSection />
      <AppearanceSection />
      <AboutSection onOpenAttributions={onOpenAttributions} />
    </SettingsFrame>
  );
}
