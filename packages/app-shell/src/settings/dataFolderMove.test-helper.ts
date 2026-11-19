import type { MoveStatus } from '@kitbag/core-native';

export const CARD = '1234-ABCD';
export const MB = 1_000_000;
export const GB = 1_000_000_000;

export function move(fields: Partial<MoveStatus> = {}): MoveStatus {
  return {
    phase: 'COPYING',
    sourceVolumeUuid: null,
    targetVolumeUuid: CARD,
    doneBytes: 540 * MB,
    totalBytes: 1.2 * GB,
    doneFiles: 24,
    totalFiles: 54,
    path: null,
    running: true,
    switched: false,
    paused: false,
    awaitingRelease: false,
    cardReturn: false,
    error: null,
    ...fields,
  };
}
