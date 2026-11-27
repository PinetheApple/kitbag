import { MenuRow, Sheet } from '@kitbag/core-design';

export interface PlayAlongMenuProps {
  readonly visible: boolean;
  readonly access: boolean;
  readonly bottomInset: number;
  readonly onNotificationAccess: () => void;
  readonly onDismiss: () => void;
}

export function PlayAlongMenu({
  visible,
  access,
  bottomInset,
  onNotificationAccess,
  onDismiss,
}: PlayAlongMenuProps) {
  return (
    <Sheet
      visible={visible}
      title="Play along"
      dismissLabel="Close the Play along menu"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <MenuRow
        icon="info"
        label="Notification access"
        value={access ? 'On' : 'Off'}
        onPress={onNotificationAccess}
      />
    </Sheet>
  );
}
