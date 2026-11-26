import {
  Button,
  Card,
  createThemedStyles,
  RowIcon,
  RowText,
  space,
  useTheme,
} from '@kitbag/core-design';
import { useCallback } from 'react';
import { View } from 'react-native';

import { usePlayAlong } from './playAlongHooks.ts';

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.rowGap },
}));

export function LibraryOfferCard() {
  const styles = useStyles();
  const theme = useTheme();
  const acceptOffer = usePlayAlong((s) => s.acceptOffer);
  const lock = useCallback(() => {
    acceptOffer().catch(() => undefined);
  }, [acceptOffer]);
  return (
    <Card emphasis="activeGroup">
      <View style={styles.row}>
        <RowIcon icon="beatGrid" color={theme.accentInk} />
        <RowText title="In your library" subtitle="Beat grid found" />
        <Button
          label="Lock"
          accessibilityLabel="Lock to the beat grid in your library"
          variant="primary"
          size="prompt"
          onPress={lock}
        />
      </View>
    </Card>
  );
}
