import {
  createThemedStyles,
  growShrinkToLine,
  Icon,
  isOverridden,
  MenuRow,
  MeterRow,
  QUEUE_TEXT,
  Sheet,
  size,
  stemPlayer,
  textRoles,
  textStyle,
  useQueueKeys,
  useTextScaled,
  type IconName,
  type QueuePresses,
} from '@kitbag/core-design';
import {
  exportBlock,
  resetValue,
  speedKeyCopy,
  useIsQueued,
  useStemPlayer,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ClickSection } from '../logic/clickView.ts';
import { exportRowValue } from '../logic/exportView.ts';
import {
  meterGridState,
  NO_GRID_REASON,
  shownMeter,
} from '../logic/meterEdit.ts';
import { ClickRows } from './ClickRows.tsx';
import { TempoRow } from './TempoSheet.tsx';
import { useMixdownProgress } from './useMixdownProgress.ts';

export const VALUE_STACKED_ID = 'menu-value-stacked';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: stemPlayer.menuRowMinHeight,
  },
  divided: {
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  label: {
    ...textStyle(textRoles.menuRow),
    color: theme.color.text,
    flexGrow: 1,
  },
  value: {
    ...textStyle(textRoles.menuValue),
    color: theme.color.text2,
    flexShrink: 1,
    textAlign: 'right',
  },
  stacked: { ...growShrinkToLine, minWidth: 0 },
  valueStacked: { textAlign: 'left' },
  off: { color: theme.color.text3 },
}));

interface ActionRowProps {
  readonly icon: IconName;
  readonly label: string;
  readonly value: string;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly divided?: boolean;
}

function ActionRow({
  icon,
  label,
  value,
  accessibilityLabel,
  onPress,
  disabled = false,
  divided = true,
}: ActionRowProps) {
  const styles = useStyles();
  const scaled = useTextScaled();
  const labelText = (
    <Text style={[styles.label, disabled && styles.off]}>{label}</Text>
  );
  const valueText = (
    <Text
      style={[
        styles.value,
        scaled && styles.valueStacked,
        disabled && styles.off,
      ]}
    >
      {value}
    </Text>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.row, divided && styles.divided]}
      onPress={onPress}
    >
      <Icon name={icon} size="title" color={disabled ? 'decor' : 'text2'} />
      {scaled ? (
        <View testID={VALUE_STACKED_ID} style={styles.stacked}>
          {labelText}
          {valueText}
        </View>
      ) : (
        <>
          {labelText}
          {valueText}
        </>
      )}
    </Pressable>
  );
}

interface ExportRowProps {
  readonly visible: boolean;
  readonly onExport: () => void;
}

function ExportRow({ visible, onExport }: ExportRowProps) {
  const block = useStemPlayer(exportBlock);
  const percent = useMixdownProgress(visible && block === 'running');
  const value = exportRowValue(block, percent);
  const disabled = block !== null;
  return (
    <ActionRow
      icon="exportMix"
      label="Export mix"
      value={value}
      accessibilityLabel={
        disabled ? `Export mix: ${value}` : 'Export mix as a WAV file'
      }
      disabled={disabled}
      divided={false}
      onPress={onExport}
    />
  );
}

function StemMeterRow({ onMeter }: { readonly onMeter: () => void }) {
  const styles = useStyles();
  const meter = useStemPlayer((s) =>
    shownMeter(s.meterOverride, s.detectedMeter),
  );
  const yours = useStemPlayer((s) => isOverridden(s.meterOverride));
  const noGrid = useStemPlayer((s) => meterGridState(s.beats) !== 'ready');
  return (
    <View style={styles.divided}>
      <MeterRow
        value={meter}
        yours={yours}
        disabled={noGrid}
        {...(noGrid ? { reason: NO_GRID_REASON } : {})}
        onPress={onMeter}
      />
    </View>
  );
}

function ResetSpeedKeyRow({ onDone }: { readonly onDone: () => void }) {
  const resetSpeedKey = useStemPlayer((s) => s.resetSpeedKey);
  const reset = useCallback(() => {
    void resetSpeedKey();
    onDone();
  }, [resetSpeedKey, onDone]);
  return (
    <ActionRow
      icon="reset"
      label={speedKeyCopy.reset}
      value={resetValue()}
      accessibilityLabel={`${speedKeyCopy.reset}: full speed, every stem at the recorded key`}
      onPress={reset}
    />
  );
}

interface QueueRowsProps {
  readonly queue: QueuePresses;
  readonly onAddToSetlist: () => void;
}

function QueueRows({ queue, onAddToSetlist }: QueueRowsProps) {
  const styles = useStyles();
  const setId = useStemPlayer((s) => s.setId);
  const queued = useIsQueued(
    setId === null ? null : { kind: 'stems', id: setId },
  );
  const keys = useQueueKeys(queue, queued);
  return (
    <View style={styles.divided}>
      <MenuRow
        icon="playNext"
        label={QUEUE_TEXT.playNext}
        onPress={keys.playNext}
      />
      <MenuRow
        icon="addToQueue"
        label={keys.addLabel}
        onPress={keys.addToQueue}
      />
      <MenuRow
        icon="addToSetlist"
        label={QUEUE_TEXT.addToSetlist}
        onPress={onAddToSetlist}
      />
    </View>
  );
}

interface PlayerMenuProps extends QueueRowsProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
  readonly onExport: () => void;
  readonly onMeter: () => void;
  readonly onTempo: () => void;
  readonly onClick: (section: ClickSection) => void;
}

export function PlayerMenu({
  visible,
  bottomInset,
  onClose,
  onExport,
  onMeter,
  onTempo,
  onClick,
  queue,
  onAddToSetlist,
}: PlayerMenuProps) {
  const resetMix = useStemPlayer((s) => s.resetMix);
  const reset = useCallback(() => {
    resetMix();
    onClose();
  }, [resetMix, onClose]);
  return (
    <Sheet
      visible={visible}
      title="Player"
      dismissLabel="Close the player menu"
      bottomInset={bottomInset}
      onDismiss={onClose}
    >
      <QueueRows queue={queue} onAddToSetlist={onAddToSetlist} />
      <ActionRow
        icon="reset"
        label="Reset mix"
        value="levels, mutes, solos"
        accessibilityLabel="Reset mix: every level to 0 dB, nothing muted or soloed"
        onPress={reset}
      />
      <ResetSpeedKeyRow onDone={onClose} />
      <StemMeterRow onMeter={onMeter} />
      <TempoRow onOpen={onTempo} />
      <ClickRows onOpen={onClick} />
      <ExportRow visible={visible} onExport={onExport} />
    </Sheet>
  );
}
