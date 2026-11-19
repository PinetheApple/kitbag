import {
  Button,
  Card,
  createThemedStyles,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useStemDeck } from '@kitbag/core-state';
import { Text, View } from 'react-native';

import { statusCardText } from './logic/progressText.ts';

const useStyles = createThemedStyles((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.controlGap },
  text: {
    ...textStyle(textRoles.fieldLabel),
    flex: 1,
    color: theme.color.text,
  },
}));

export function ImportStatusCard({ onView }: { readonly onView: () => void }) {
  const styles = useStyles();
  const view = useStemDeck((s) => s.importView);
  if (!view?.running) return null;
  const text = statusCardText(view);
  return (
    <Card>
      <View style={styles.row}>
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {text}
        </Text>
        <Button
          variant="ghost"
          size="prompt"
          label="View"
          accessibilityLabel="View the StemDeck import"
          onPress={onView}
        />
      </View>
    </Card>
  );
}
