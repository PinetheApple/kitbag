import {
  Button,
  createThemedStyles,
  space,
  useTextScaled,
} from '@kitbag/core-design';
import { View } from 'react-native';

export interface Choice {
  readonly key: string;
  readonly label: string;
  readonly primary: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', gap: space.controlGap },
  stacked: { gap: space.controlGap },
}));

export function ChoiceButtons({
  choices,
}: {
  readonly choices: readonly Choice[];
}) {
  const styles = useStyles();
  const stacked = useTextScaled();
  if (choices.length === 0) return null;
  const ordered = stacked ? [...choices].reverse() : choices;
  return (
    <View style={stacked ? styles.stacked : styles.row}>
      {ordered.map((choice) => (
        <Button
          key={choice.key}
          fill
          variant={choice.primary ? 'primary' : 'ghost'}
          label={choice.label}
          disabled={choice.disabled}
          onPress={choice.onPress}
        />
      ))}
    </View>
  );
}
