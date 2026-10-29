import { useCallback } from 'react';
import {
  Pressable,
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
}

const RENAME_ACTION = 'rename';
const RENAME_ACTIONS = [{ name: RENAME_ACTION, label: 'Rename' }];

export function LevelChip({
  label,
  gain,
  open,
  onPress,
  onRename,
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
      accessibilityState={{ expanded: open }}
      accessibilityActions={onRename === undefined ? undefined : RENAME_ACTIONS}
      onAccessibilityAction={act}
      style={LEVEL_HIT_BOX}
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
