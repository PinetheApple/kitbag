import {
  getKitbagLibrary,
  type IntakeEvent,
  type PickedBackup,
} from './NativeKitbagLibrary';

export function takeLaunchIntake(): Promise<IntakeEvent> {
  return getKitbagLibrary().takeLaunchIntake();
}

export function watchIntake(
  listener: (intake: IntakeEvent) => void,
): () => void {
  const subscription = getKitbagLibrary().onIntake(listener);
  return () => {
    subscription.remove();
  };
}

export function readSharedBackup(uri: string): Promise<PickedBackup> {
  return getKitbagLibrary().readSharedBackup(uri);
}
