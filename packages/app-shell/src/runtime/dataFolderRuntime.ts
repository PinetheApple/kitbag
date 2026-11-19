import {
  cancelMove,
  dataFolderCodes,
  listVolumes,
  moveStatus,
  releaseOldCopies,
  resumeMove,
  startMove,
  switchToInternalStorage,
  undoMove,
  watchDataFolder,
  watchMove,
} from '@kitbag/core-native';
import { configureDataFolder, dataFolderStore } from '@kitbag/core-state';

configureDataFolder({
  codes: dataFolderCodes,
  listVolumes,
  startMove,
  cancelMove,
  resumeMove,
  undoMove,
  moveStatus,
  switchToInternalStorage,
  releaseOldCopies,
  watchMove,
  watchDataFolder,
});

// Old copies wait on the players from launch, whichever screen is open.
dataFolderStore
  .getState()
  .start()
  .catch((error: unknown) => {
    console.warn('[kitbag] Data folder listener not started', error);
  });
