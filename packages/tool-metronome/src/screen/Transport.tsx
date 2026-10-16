import {
  PrimaryPlayButton,
  space,
  TransportKey,
  TransportKeySpacer,
} from '@kitbag/core-design';
import { StyleSheet, View } from 'react-native';

interface TransportProps {
  readonly running: boolean;
  readonly onToggle: () => void;
  readonly canResetPractice: boolean;
  readonly onResetPractice: () => void;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.transportGap,
  },
});

export function Transport({
  running,
  onToggle,
  canResetPractice,
  onResetPractice,
}: TransportProps) {
  return (
    <View style={styles.row}>
      <TransportKeySpacer />
      <PrimaryPlayButton
        glyph={running ? 'stop' : 'play'}
        accessibilityLabel={running ? 'Stop' : 'Play'}
        onPress={onToggle}
      />
      {/* The pill's twin follows the pill: absent, not disabled, at 0:00. */}
      {canResetPractice ? (
        <TransportKey
          icon="practice"
          accessibilityLabel="Reset practice timer"
          onPress={onResetPractice}
        />
      ) : (
        <TransportKeySpacer />
      )}
    </View>
  );
}
