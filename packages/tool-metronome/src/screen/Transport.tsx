import {
  PrimaryPlayButton,
  space,
  TransportKey,
  TransportKeySpacer,
} from '@kitbag/core-design';
import { StyleSheet, View } from 'react-native';

interface TransportProps {
  readonly running: boolean;
  readonly armedCount: number;
  readonly onToggle: () => void;
  readonly onOpenPractice: () => void;
  readonly onOpenSetlists?: (() => void) | undefined;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.transportGapWide,
    marginTop: 'auto',
    marginBottom: space.belowTransport,
  },
});

function practiceLabel(armedCount: number): string {
  return armedCount === 0
    ? 'Practice tools'
    : `Practice tools, ${String(armedCount)} on`;
}

export function Transport({
  running,
  armedCount,
  onToggle,
  onOpenPractice,
  onOpenSetlists,
}: TransportProps) {
  const armed = armedCount > 0;
  return (
    <View style={styles.row}>
      {onOpenSetlists === undefined ? (
        <TransportKeySpacer size="large" />
      ) : (
        <TransportKey
          size="large"
          icon="setlist"
          accessibilityLabel="Setlists"
          onPress={onOpenSetlists}
        />
      )}
      <PrimaryPlayButton
        size="large"
        glyph={running ? 'stop' : 'play'}
        accessibilityLabel={running ? 'Stop' : 'Play'}
        onPress={onToggle}
      />
      <TransportKey
        size="large"
        icon="practiceTools"
        accessibilityLabel={practiceLabel(armedCount)}
        selected={armed}
        badge={armed ? String(armedCount) : undefined}
        onPress={onOpenPractice}
      />
    </View>
  );
}
