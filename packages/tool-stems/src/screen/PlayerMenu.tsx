import {
  createThemedStyles,
  Icon,
  isOverridden,
  MeterRow,
  Sheet,
  size,
  stemPlayer,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { exportBlock, useStemPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { exportRowValue } from '../logic/exportView.ts';
import {
  meterGridState,
  NO_GRID_REASON,
  shownMeter,
} from '../logic/meterEdit.ts';
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

interface PlayerMenuProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
  readonly onExport: () => void;
  readonly onMeter: () => void;
}

export function PlayerMenu({
  visible,
  bottomInset,
  onClose,
  onExport,
  onMeter,
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
      <ExportRow visible={visible} onExport={onExport} />
    </Sheet>
  );
}
