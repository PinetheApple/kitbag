import type { DataFolderCodes } from '@kitbag/core-native';

export const DATA_FOLDER_CODES: DataFolderCodes = {
  moveOutcomes: {
    done: 'done',
    cancelled: 'cancelled',
    awaitingRelease: 'awaitingRelease',
    cleanupDeferred: 'cleanupDeferred',
    noMove: 'noMove',
    failed: 'failed',
    refused: 'refused',
  },
  movePhases: [
    'PREFLIGHT',
    'COPYING',
    'VERIFYING',
    'CATCH_UP',
    'SWITCHED',
    'CLEANING',
    'DONE',
  ],
  moveErrors: {
    sourceUnavailable: 'E_MOVE_SOURCE_UNAVAILABLE',
    targetUnavailable: 'E_MOVE_TARGET_UNAVAILABLE',
    targetOccupied: 'E_MOVE_TARGET_OCCUPIED',
    noSpace: 'E_MOVE_NO_SPACE',
    targetNotWritable: 'E_MOVE_TARGET_NOT_WRITABLE',
    hashMismatch: 'E_MOVE_HASH_MISMATCH',
    io: 'E_MOVE_IO',
    sameLocation: 'E_MOVE_SAME_LOCATION',
    inProgress: 'E_MOVE_IN_PROGRESS',
    noMove: 'E_MOVE_NO_MOVE',
    running: 'E_MOVE_RUNNING',
    switched: 'E_MOVE_SWITCHED',
    useInternalRefused: 'E_MOVE_USE_INTERNAL_REFUSED',
    foregroundRefused: 'E_MOVE_FOREGROUND_REFUSED',
  },
  volumeStates: {
    mounted: 'mounted',
    readOnly: 'readOnly',
    unmounted: 'unmounted',
  },
};
