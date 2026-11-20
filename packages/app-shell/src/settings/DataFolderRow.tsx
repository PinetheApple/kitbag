import {
  createThemedStyles,
  dataFolder,
  EditRow,
  EditValue,
  rowLabel,
} from '@kitbag/core-design';
import {
  returnedCards,
  useDataFolder,
  type DataFolderStore,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import {
  DATA_FOLDER_LABEL,
  dataFolderRowValue,
  rowValueLabel,
  type RowValue,
} from './dataFolderText.ts';
import { returnedRowValue, STILL_ON_CARD } from './returnedCardText.ts';

const firstReturned = (state: DataFolderStore) =>
  returnedCards(state)[0] ?? null;

const useStyles = createThemedStyles((theme) => ({
  highlighted: {
    backgroundColor: theme.activeCardFill,
    borderLeftWidth: dataFolder.highlightEdge,
    borderLeftColor: theme.color.accent,
  },
  missing: { color: theme.color.redInk },
}));

function RowValueText({ value }: { readonly value: RowValue }) {
  const styles = useStyles();
  if (value.missing) {
    return (
      <EditValue>
        <Text style={styles.missing}>{value.lead}</Text>
      </EditValue>
    );
  }
  return (
    <EditValue>
      {value.detail === null ? value.lead : `${value.lead} `}
      {value.detail === null ? null : (
        <EditValue muted>{value.detail}</EditValue>
      )}
    </EditValue>
  );
}

export function DataFolderRow({ onOpen }: { readonly onOpen: () => void }) {
  const styles = useStyles();
  const volumes = useDataFolder((s) => s.volumes);
  const move = useDataFolder((s) => s.move);
  const value = volumes === null ? null : dataFolderRowValue(volumes, move);
  return (
    <View style={value?.highlighted === true && styles.highlighted}>
      <EditRow
        label={DATA_FOLDER_LABEL}
        accessibilityLabel={
          value === null
            ? DATA_FOLDER_LABEL
            : rowLabel(DATA_FOLDER_LABEL, rowValueLabel(value))
        }
        onPress={onOpen}
      >
        {value === null ? null : <RowValueText value={value} />}
      </EditRow>
    </View>
  );
}

export function ReturnedCardRow({
  onOffer,
}: {
  readonly onOffer: (volumeUuid: string) => void;
}) {
  const styles = useStyles();
  const card = useDataFolder(firstReturned);
  const volumeUuid = card?.volumeUuid ?? null;
  const offer = useCallback(() => {
    if (volumeUuid !== null) onOffer(volumeUuid);
  }, [onOffer, volumeUuid]);
  if (card === null) return null;
  const value = returnedRowValue(card);
  return (
    <View style={styles.highlighted}>
      <EditRow
        label={STILL_ON_CARD}
        accessibilityLabel={rowLabel(STILL_ON_CARD, rowValueLabel(value))}
        onPress={offer}
      >
        <RowValueText value={value} />
      </EditRow>
    </View>
  );
}
