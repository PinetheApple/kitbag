import type {
  DataFolderCodes,
  DataFolderVolumes,
  MoveListeners,
  MoveStatus,
} from '@kitbag/core-native';

export interface DataFolderNative {
  readonly codes: () => DataFolderCodes;
  readonly listVolumes: () => Promise<DataFolderVolumes>;
  readonly startMove: (volumeUuid: string | null) => Promise<void>;
  readonly cancelMove: () => Promise<void>;
  readonly resumeMove: () => Promise<void>;
  readonly undoMove: () => Promise<void>;
  readonly moveStatus: () => Promise<MoveStatus | null>;
  readonly switchToInternalStorage: (
    awayPaths: readonly string[],
  ) => Promise<void>;
  readonly releaseOldCopies: () => void;
  readonly watchMove: (listeners: MoveListeners) => () => void;
  readonly watchDataFolder: (listener: () => void) => () => void;
}

let configured: DataFolderNative | undefined;

export function configureDataFolder(native: DataFolderNative): void {
  if (configured !== undefined && configured !== native) {
    throw new Error('The data folder is already configured');
  }
  configured = native;
}

export function getDataFolder(): DataFolderNative {
  if (configured === undefined) {
    throw new Error('The data folder is not configured');
  }
  return configured;
}
