import {
  createThemedStyles,
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
} from '@kitbag/core-design';
import { exportBlock, useIsQueued, useStemPlayer } from '@kitbag/core-state';
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
  off: { color: theme.color.text3 },
}));

interface ExportRowProps {
  readonly visible: boolean;
  readonly onExport: () => void;
}

function ExportRow({ visible, onExport }: ExportRowProps) {
  const styles = useStyles();
  const block = useStemPlayer(exportBlock);
  const percent = useMixdownProgress(visible && block === 'running');
  const value = exportRowValue(block, percent);
  const disabled = block !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        disabled ? `Export mix: ${value}` : 'Export mix as a WAV file'
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={styles.row}
      onPress={onExport}
    >
      <Icon
        name="exportMix"
        size="title"
        color={disabled ? 'decor' : 'text2'}
      />
      <Text style={[styles.label, disabled && styles.off]}>Export mix</Text>
      <Text style={[styles.value, disabled && styles.off]}>{value}</Text>
    </Pressable>
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

interface QueueRowsProps {
  readonly onPlayNext: () => void;
  readonly onAddToSetlist: () => void;
}

function QueueRows({ onPlayNext, onAddToSetlist }: QueueRowsProps) {
  const styles = useStyles();
  const setId = useStemPlayer((s) => s.setId);
  const queued = useIsQueued(setId);
  return (
    <View style={styles.divided}>
      <MenuRow
        icon={queued ? 'inUpNext' : 'playNext'}
        label={queued ? QUEUE_TEXT.inUpNext : QUEUE_TEXT.playNext}
        disabled={queued}
        onPress={onPlayNext}
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
  onPlayNext,
  onAddToSetlist,
}: PlayerMenuProps) {
  const styles = useStyles();
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
      <QueueRows onPlayNext={onPlayNext} onAddToSetlist={onAddToSetlist} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reset mix: every level to 0 dB, nothing muted or soloed"
        style={[styles.row, styles.divided]}
        onPress={reset}
      >
        <Icon name="reset" size="title" color="text2" />
        <Text style={styles.label}>Reset mix</Text>
        <Text style={styles.value}>levels, mutes, solos</Text>
      </Pressable>
      <StemMeterRow onMeter={onMeter} />
      <TempoRow onOpen={onTempo} />
      <ClickRows onOpen={onClick} />
      <ExportRow visible={visible} onExport={onExport} />
    </Sheet>
  );
}
