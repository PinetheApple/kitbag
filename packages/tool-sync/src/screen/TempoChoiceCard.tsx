import {
  Button,
  Card,
  createThemedStyles,
  RowIcon,
  RowText,
  space,
} from '@kitbag/core-design';
import { View } from 'react-native';

import { shownBpm } from '../logic/tempoLine.ts';
import { usePlayAlong } from './playAlongHooks.ts';

const useStyles = createThemedStyles(() => ({
  stack: { gap: space.sectionGap },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.rowGap },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.controlGap },
}));

export function TempoChoiceCard() {
  const styles = useStyles();
  const choice = usePlayAlong((s) => s.tapAlong.tempoChoice);
  const chooseTapped = usePlayAlong((s) => s.chooseTappedTempo);
  const chooseSong = usePlayAlong((s) => s.chooseSongTempo);
  if (choice === undefined) return null;
  const tapped = shownBpm(choice.tappedBpm);
  const song = shownBpm(choice.songBpm);
  return (
    <Card borderTone="warning">
      <View style={styles.stack}>
        <View style={styles.row}>
          <RowIcon icon="error" />
          <RowText
            title={`Your taps say ${tapped}, the song says ${song}`}
            subtitle="Phase is set from your taps either way."
          />
        </View>
        <View style={styles.actions}>
          <Button
            label={`Use ${tapped}`}
            variant="primary"
            size="prompt"
            fill
            onPress={chooseTapped}
          />
          <Button
            label={`Keep ${song}`}
            variant="tonal"
            size="prompt"
            fill
            onPress={chooseSong}
          />
        </View>
      </View>
    </Card>
  );
}
