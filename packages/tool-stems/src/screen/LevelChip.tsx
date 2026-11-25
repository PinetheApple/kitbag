import { opacity } from '@kitbag/core-design';
import { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
} from 'react-native';

import { formatDb, isUnity, WIDEST_DB_LABEL } from '../logic/fader.ts';
import { LEVEL_HIT_BOX, useStemStyles } from './stemStyles.ts';

interface LevelChipProps {
  readonly label: string;
  readonly gain: number;
  readonly open: boolean;
  readonly onPress: () => void;
  readonly onRename?: () => void;
  readonly disabled?: boolean;
}

const off = StyleSheet.create({ level: { opacity: opacity.muted } });

const RENAME_ACTION = 'rename';
const RENAME_ACTIONS = [{ name: RENAME_ACTION, label: 'Rename' }];

export function LevelChip({
  label,
  gain,
  open,
  onPress,
  onRename,
  disabled = false,
}: LevelChipProps) {
  const styles = useStemStyles();
  const db = formatDb(gain);
  const act = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === RENAME_ACTION) onRename?.();
    },
    [onRename],
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} volume, ${db}, ${open ? 'collapse' : 'expand'}`}
      accessibilityState={{ expanded: open, disabled }}
      accessibilityActions={onRename === undefined ? undefined : RENAME_ACTIONS}
      onAccessibilityAction={act}
      style={[LEVEL_HIT_BOX, disabled && off.level]}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={[styles.level, open && styles.levelOpen]}>
        <Text style={[styles.levelText, styles.levelSizer]}>
          {WIDEST_DB_LABEL}
        </Text>
        <Text
          style={[
            styles.levelText,
            styles.levelShown,
            isUnity(gain) && styles.levelTextZero,
            open && styles.levelTextOpen,
          ]}
        >
          {db}
        </Text>
      </View>
    </Pressable>
  );
}
