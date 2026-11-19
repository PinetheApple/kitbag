import { Button } from '@kitbag/core-design';
import { Text, View } from 'react-native';

import { importLabel } from './logic/songFacts.ts';
import { useInset, useStemDeckStyles } from './stemDeckStyles.ts';

const UNITY_NOTE =
  'Songs arrive with every stem at its default level. A mix you made in StemDeck stays on the computer.';

export interface ImportDockProps {
  readonly count: number;
  readonly showNote: boolean;
  readonly bottomInset: number;
  readonly onImport: () => void;
}

export function ImportDock({
  count,
  showNote,
  bottomInset,
  onImport,
}: ImportDockProps) {
  const styles = useStemDeckStyles();
  const dock = useInset(styles.dock, 'paddingBottom', bottomInset);
  return (
    <View style={dock}>
      {showNote ? <Text style={styles.hint}>{UNITY_NOTE}</Text> : null}
      <Button
        variant="primary"
        size="target"
        icon="saveInto"
        label={importLabel(count)}
        disabled={count === 0}
        outlinedWhenDisabled
        onPress={onImport}
      />
    </View>
  );
}
