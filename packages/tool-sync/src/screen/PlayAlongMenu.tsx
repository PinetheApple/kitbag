import { MenuRow, Sheet } from '@kitbag/core-design';

export interface PlayAlongMenuProps {
  readonly visible: boolean;
  readonly access: boolean;
  readonly soundLabel: string;
  readonly bottomInset: number;
  readonly onSave: (() => void) | null;
  readonly onClickSound: () => void;
  readonly onNotificationAccess: () => void;
  readonly onDismiss: () => void;
}

export function PlayAlongMenu({
  visible,
  access,
  soundLabel,
  bottomInset,
  onSave,
  onClickSound,
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
      {onSave === null ? null : (
        <MenuRow icon="saveInto" label="Save for this song" onPress={onSave} />
      )}
      <MenuRow
        icon="sound"
        label="Click sound"
        value={soundLabel}
        onPress={onClickSound}
      />
      <MenuRow
        icon="info"
        label="Notification access"
        value={access ? 'On' : 'Off'}
        onPress={onNotificationAccess}
      />
    </Sheet>
  );
}
