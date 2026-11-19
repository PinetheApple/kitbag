import type {
  DataFolderCodes,
  DataFolderVolumes,
  MoveStatus,
} from '@kitbag/core-native';
import {
  createDataFolderStore,
  type DataFolderNative,
} from '@kitbag/core-state';
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

import { CARD } from '../settings/dataFolderMove.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

export const AWAY_PATHS = ['songs/a/a.mp3', 'stems/r/bass.flac'];

export const CODES = {
  moveOutcomes: { failed: 'failed', refused: 'refused' },
  movePhases: { copying: 'COPYING', verifying: 'VERIFYING' },
  moveErrors: {
    io: 'E_MOVE_IO',
    targetUnavailable: 'E_MOVE_TARGET_UNAVAILABLE',
    running: 'E_MOVE_RUNNING',
    noMove: 'E_MOVE_NO_MOVE',
    importLockHeld: 'E_MOVE_IMPORT_LOCK_HELD',
    cardMounted: 'E_MOVE_CARD_MOUNTED',
  },
  volumeStates: { mounted: 'mounted', unmounted: 'unmounted' },
} as unknown as DataFolderCodes;

export const CARD_OUT: DataFolderVolumes = {
  currentVolumeUuid: CARD,
  currentAvailable: false,
  requiredBytes: null,
  volumes: [
    {
      volumeUuid: CARD,
      name: 'SanDisk SD card',
      state: 'unmounted',
      inUse: true,
      freeBytes: 0,
      totalBytes: 0,
      awayFiles: 0,
      awayBytes: 0,
    },
  ],
};

export function fakeFolder(
  volumes: DataFolderVolumes,
  move: MoveStatus | null = null,
) {
  const native = {
    codes: vi.fn(() => CODES),
    listVolumes: vi.fn(() => Promise.resolve(volumes)),
    startMove: vi.fn(() => Promise.resolve()),
    startCardReturn: vi.fn(() => Promise.resolve()),
    cancelMove: vi.fn(() => Promise.resolve()),
    resumeMove: vi.fn(() => Promise.resolve()),
    undoMove: vi.fn(() => Promise.resolve()),
    moveStatus: vi.fn(() => Promise.resolve(move)),
    switchToInternalStorage: vi.fn(() => Promise.resolve()),
    releaseOldCopies: vi.fn(),
    watchMove: vi.fn(() => () => undefined),
    watchDataFolder: vi.fn(() => () => undefined),
  } satisfies DataFolderNative;
  const store = createDataFolderStore({
    native: () => native,
    storedFiles: () =>
      Promise.resolve(
        AWAY_PATHS.map((path) => ({
          row: {} as never,
          audioPaths: [path],
          waveformPaths: [],
        })),
      ),
    players: {
      tracks: () => ({ song: null, stems: null }),
      subscribe: () => () => undefined,
    },
  });
  return { native, store };
}

export function hostMock(name: string) {
  return function Host(props: Props) {
    return createElement(name, props, props.children);
  };
}

export function refusal(code: string): Error {
  return Object.assign(new Error('refused'), { code });
}
