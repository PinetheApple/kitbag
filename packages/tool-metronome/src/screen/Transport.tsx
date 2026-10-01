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
  readonly onResetPractice: () => void;
  readonly onOpenSetlists?: (() => void) | undefined;
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
  onResetPractice,
  onOpenSetlists,
}: TransportProps) {
  return (
    <View style={styles.row}>
      {onOpenSetlists === undefined ? (
        <TransportKeySpacer />
      ) : (
        <TransportKey
          icon="setlist"
          accessibilityLabel="Setlists"
          onPress={onOpenSetlists}
        />
      )}
      <PrimaryPlayButton
        glyph={running ? 'stop' : 'play'}
        accessibilityLabel={running ? 'Stop' : 'Play'}
        onPress={onToggle}
      />
      <TransportKey
        icon="practice"
        accessibilityLabel="Reset practice timer"
        onPress={onResetPractice}
      />
    </View>
  );
}
