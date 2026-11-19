import {
  Button,
  createThemedStyles,
  space,
  useTextScaled,
} from '@kitbag/core-design';
import { View } from 'react-native';

export interface Choice {
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', gap: space.controlGap },
  stacked: { gap: space.controlGap },
}));

function ChoiceButton({
  choice,
  primary,
}: {
  readonly choice: Choice;
  readonly primary: boolean;
}) {
  return (
    <Button
      fill
      variant={primary ? 'primary' : 'ghost'}
      label={choice.label}
      disabled={choice.disabled}
      onPress={choice.onPress}
    />
  );
}

export function ChoiceButtons({
  secondary,
  primary,
}: {
  readonly secondary: Choice | null;
  readonly primary: Choice;
}) {
  const styles = useStyles();
  const stacked = useTextScaled();
  const lead = <ChoiceButton choice={primary} primary />;
  const other =
    secondary === null ? null : (
      <ChoiceButton choice={secondary} primary={false} />
    );
  return (
    <View style={stacked ? styles.stacked : styles.row}>
      {stacked ? lead : other}
      {stacked ? other : lead}
    </View>
  );
}
