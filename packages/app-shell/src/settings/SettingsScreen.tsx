import {
  EditGroup,
  EditRow,
  EditValue,
  Icon,
  inset,
  SectionHeader,
  SegmentedControl,
  size,
  Switch,
  type SegmentOption,
} from '@kitbag/core-design';
import { useAppearance, type ThemeChoice } from '@kitbag/core-state';
import { useCallback, type ReactNode } from 'react';
import { Linking, Pressable, type AccessibilityRole } from 'react-native';

import {
  installedVersion,
  LICENCE_NAME,
  LICENCE_URL,
  SOURCE_LABEL,
  SOURCE_URL,
} from './about.ts';
import { SettingsFrame } from './SettingsFrame.tsx';

const THEME_OPTIONS: readonly SegmentOption<ThemeChoice>[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const ROW_TO_ROW = inset.editRowV * 2 + size.stroke;
const ROW_CONTROL_GAPS = { top: ROW_TO_ROW, bottom: ROW_TO_ROW };

function openUrl(url: string): void {
  Linking.openURL(url).catch((error: unknown) => {
    console.warn('[kitbag] could not open link', error);
  });
}

function Chevron() {
  return <Icon name="forward" size="control" color="text3" />;
}

interface PressableRowProps {
  readonly label: string;
  readonly role: AccessibilityRole;
  readonly onPress: () => void;
  readonly children: ReactNode;
}

function PressableRow({ label, role, onPress, children }: PressableRowProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      onPress={onPress}
    >
      <EditRow label={label}>{children}</EditRow>
    </Pressable>
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
            accessibilityLabel="Theme"
            options={THEME_OPTIONS}
            selected={theme}
            onSelect={setTheme}
            neighbourGapDp={ROW_CONTROL_GAPS}
          />
        </EditRow>
        <EditRow label="Haptics">
          <Switch
            variant="outlined"
            accessibilityLabel="Haptics"
            value={haptics}
            onValueChange={setHaptics}
            neighbourGapDp={ROW_CONTROL_GAPS}
          />
        </EditRow>
        <EditRow label="Keep screen awake">
          <Switch
            variant="outlined"
            accessibilityLabel="Keep screen awake"
            value={keepScreenAwake}
            onValueChange={setKeepScreenAwake}
            neighbourGapDp={ROW_CONTROL_GAPS}
          />
        </EditRow>
      </EditGroup>
    </>
  );
}

function AboutSection({
  onOpenAttributions,
}: {
  readonly onOpenAttributions: () => void;
}) {
  const version = installedVersion();
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
        {version === undefined ? null : (
          <EditRow label="Version">
            <EditValue muted>{version}</EditValue>
          </EditRow>
        )}
        <PressableRow label="Licence" role="link" onPress={openLicence}>
          <EditValue>{LICENCE_NAME}</EditValue>
          <Chevron />
        </PressableRow>
        <PressableRow label="Source & issues" role="link" onPress={openSource}>
          <EditValue muted>{SOURCE_LABEL}</EditValue>
          <Chevron />
        </PressableRow>
        <PressableRow
          label="Attributions"
          role="button"
          onPress={onOpenAttributions}
        >
          <Chevron />
        </PressableRow>
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
      <AppearanceSection />
      <AboutSection onOpenAttributions={onOpenAttributions} />
    </SettingsFrame>
  );
}
