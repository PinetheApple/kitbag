import { Pressable, Text, View } from 'react-native';

import { formatDb, isUnity, WIDEST_DB_LABEL } from '../logic/fader.ts';
import { LEVEL_HIT_BOX, useStemStyles } from './stemStyles.ts';

interface LevelChipProps {
  readonly label: string;
  readonly gain: number;
  readonly open: boolean;
  readonly onPress: () => void;
}

export function LevelChip({ label, gain, open, onPress }: LevelChipProps) {
  const styles = useStemStyles();
  const db = formatDb(gain);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} volume, ${db}, ${open ? 'collapse' : 'expand'}`}
      accessibilityState={{ expanded: open }}
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
