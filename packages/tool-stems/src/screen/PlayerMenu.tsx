import {
  createThemedStyles,
  Icon,
  Sheet,
  stemPlayer,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { exportBlock, useStemPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, Text } from 'react-native';

import type { ClickSection } from '../logic/clickView.ts';
import { exportRowValue } from '../logic/exportView.ts';
import { ClickRows } from './ClickRows.tsx';
import { useMixdownProgress } from './useMixdownProgress.ts';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: stemPlayer.menuRowMinHeight,
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

interface PlayerMenuProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
  readonly onExport: () => void;
  readonly onClick: (section: ClickSection) => void;
}

export function PlayerMenu({
  visible,
  bottomInset,
  onClose,
  onExport,
  onClick,
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
        style={styles.row}
        onPress={reset}
      >
        <Icon name="reset" size="title" color="text2" />
        <Text style={styles.label}>Reset mix</Text>
        <Text style={styles.value}>levels, mutes, solos</Text>
      </Pressable>
      <ClickRows onOpen={onClick} />
      <ExportRow visible={visible} onExport={onExport} />
    </Sheet>
  );
}
