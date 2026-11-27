import {
  getKitbagLibrary,
  type PickedBackup,
  type PickedDocument,
} from './NativeKitbagLibrary';

export function takeLaunchIntake(): Promise<readonly PickedDocument[]> {
  return getKitbagLibrary().takeLaunchIntake();
}

export function watchIntake(
  listener: (items: readonly PickedDocument[]) => void,
): () => void {
  const subscription = getKitbagLibrary().onIntake(({ items }) => {
    listener(items);
  });
  return () => {
    subscription.remove();
  };
}

export function readSharedBackup(uri: string): Promise<PickedBackup> {
  return getKitbagLibrary().readSharedBackup(uri);
}
