import {
  Button,
  Card,
  createThemedStyles,
  FACT_SEPARATOR,
  RowIcon,
  RowText,
  space,
  timeSignatureLabel,
  useTheme,
} from '@kitbag/core-design';
import type { LibraryOffer } from '@kitbag/core-state';
import { useCallback } from 'react';
import { View } from 'react-native';

import { usePlayAlong } from './playAlongHooks.ts';

const GRID_FOUND = 'Beat grid found';

function offerSubtitle(meter: LibraryOffer['meter']): string {
  if (meter === undefined) return GRID_FOUND;
  const shown = timeSignatureLabel({
    beats: meter.beatsPerBar,
    denominator: meter.denominator,
  });
  return `${GRID_FOUND}${FACT_SEPARATOR}${shown} from your preset`;
}

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.rowGap },
}));

export function LibraryOfferCard() {
  const styles = useStyles();
  const theme = useTheme();
  const acceptOffer = usePlayAlong((s) => s.acceptOffer);
  const meter = usePlayAlong((s) => s.offer?.meter);
  const lock = useCallback(() => {
    acceptOffer().catch(() => undefined);
  }, [acceptOffer]);
  return (
    <Card emphasis="activeGroup">
      <View style={styles.row}>
        <RowIcon icon="beatGrid" color={theme.accentInk} />
        <RowText title="In your library" subtitle={offerSubtitle(meter)} />
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
