import { ListRow, Sheet } from '@kitbag/core-design';

export interface AddStemSongSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
  readonly onFromPhone: () => void;
  readonly onFromStemDeck: () => void;
}

export function AddStemSongSheet({
  visible,
  bottomInset,
  onDismiss,
  onFromPhone,
  onFromStemDeck,
}: AddStemSongSheetProps) {
  return (
    <Sheet
      visible={visible}
      title="Add a stem song"
      titleSize="large"
      dismissLabel="Close"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <ListRow
        icon="folder"
        title="From this phone"
        subtitle="A StemDeck .zip or its folder"
        onPress={onFromPhone}
      />
      <ListRow
        icon="stemDeckServer"
        title="From StemDeck on Wi-Fi"
        subtitle="Scan its QR code or type its address"
        onPress={onFromStemDeck}
      />
    </Sheet>
  );
}
