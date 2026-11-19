import {
  getKitbagLibrary,
  type DataFolderVolumes,
  type MoveErrors,
  type MoveFinished,
  type MoveOutcomes,
  type MoveStatus,
  type VolumeStates,
} from './NativeKitbagLibrary';

export type DataFolderCodes = Readonly<{
  moveOutcomes: MoveOutcomes;
  movePhases: readonly string[];
  moveErrors: MoveErrors;
  volumeStates: VolumeStates;
}>;

export interface MoveListeners {
  readonly progress: (status: MoveStatus) => void;
  readonly finished: (finished: MoveFinished) => void;
}

export function dataFolderCodes(): DataFolderCodes {
  const { moveOutcomes, movePhases, moveErrors, volumeStates } =
    getKitbagLibrary().getConstants();
  return { moveOutcomes, movePhases, moveErrors, volumeStates };
}

export function listVolumes(): Promise<DataFolderVolumes> {
  return getKitbagLibrary().listVolumes();
}

export function startMove(volumeUuid: string | null): Promise<void> {
  return getKitbagLibrary().startMove(volumeUuid);
}

export function cancelMove(): Promise<void> {
  return getKitbagLibrary().cancelMove();
}

export function resumeMove(): Promise<void> {
  return getKitbagLibrary().resumeMove();
}

export function undoMove(): Promise<void> {
  return getKitbagLibrary().undoMove();
}

export function moveStatus(): Promise<MoveStatus | null> {
  return getKitbagLibrary().moveStatus();
}

export function switchToInternalStorage(
  awayPaths: readonly string[],
): Promise<void> {
  return getKitbagLibrary().useInternalStorage(awayPaths);
}

export function releaseOldCopies(): void {
  getKitbagLibrary().releaseOldCopies();
}

export function watchMove(listeners: MoveListeners): () => void {
  const library = getKitbagLibrary();
  const progress = library.onMoveProgress(listeners.progress);
  const finished = library.onMoveFinished(listeners.finished);
  return () => {
    progress.remove();
    finished.remove();
  };
}
