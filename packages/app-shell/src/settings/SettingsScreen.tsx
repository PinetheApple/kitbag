import {
  EDIT_ROW_PRESSABLE_GAP,
  EditGroup,
  EditRow,
  EditSwitchRow,
  EditValue,
  SectionHeader,
  SegmentedControl,
  type SegmentOption,
} from '@kitbag/core-design';
import { getAppVersion } from '@kitbag/core-native';
import { useAppearance, type ThemeChoice } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform } from 'react-native';

import {
  LICENCE_NAME,
  LICENCE_URL,
  SOURCE_LABEL,
  SOURCE_URL,
} from './about.ts';
import { formatAppVersion } from './appVersion.ts';
import { formatPracticeSummary } from './practiceText.ts';
import { SettingsFrame } from './SettingsFrame.tsx';
import { StorageSheet } from './StorageSheet.tsx';
import { storageSummary } from './storageText.ts';
import { usePracticeStats } from './usePracticeStats.ts';
import { useStorageReport } from './useStorageReport.ts';

const THEME_OPTIONS: readonly SegmentOption<ThemeChoice>[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const THEME_CONTROL_GAPS = { bottom: EDIT_ROW_PRESSABLE_GAP };

const LICENCE_LABEL = 'Licence';
const STORAGE_LABEL = 'Storage';
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

function DataSection() {
  const { report, refresh } = useStorageReport();
  const summary = report === null ? null : storageSummary(report);
  const [storageOpen, setStorageOpen] = useState(false);
  const openStorage = useCallback(() => {
    setStorageOpen(true);
  }, []);
  const closeStorage = useCallback(() => {
    setStorageOpen(false);
  }, []);
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
          onPress={openStorage}
        >
          {summary === null ? null : <EditValue>{summary}</EditValue>}
        </EditRow>
      </EditGroup>
      <StorageSheet
        visible={storageOpen}
        report={report}
        onShow={refresh}
        onDismiss={closeStorage}
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
          variant="outlined"
          label="Haptics"
          value={haptics}
          onValueChange={setHaptics}
        />
        <EditSwitchRow
          variant="outlined"
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
}

export function SettingsScreen({
  onBack,
  onOpenAttributions,
}: SettingsScreenProps) {
  return (
    <SettingsFrame title="Settings" onBack={onBack}>
      <DataSection />
      <AppearanceSection />
      <AboutSection onOpenAttributions={onOpenAttributions} />
    </SettingsFrame>
  );
}
