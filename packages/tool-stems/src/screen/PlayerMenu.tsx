import {
  createThemedStyles,
  Icon,
  Sheet,
  stemPlayer,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, Text } from 'react-native';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: stemPlayer.menuRowMinHeight,
  },
  label: { ...textStyle(textRoles.menuRow), color: theme.color.text, flex: 1 },
  value: { ...textStyle(textRoles.menuValue), color: theme.color.text2 },
}));

interface PlayerMenuProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

export function PlayerMenu({ visible, bottomInset, onClose }: PlayerMenuProps) {
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
    </Sheet>
  );
}
