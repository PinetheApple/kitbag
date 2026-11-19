import type {
  DataFolderVolumes,
  MoveFinished,
  MoveListeners,
  MoveStatus,
} from '@kitbag/core-native';
import { expect, vi } from 'vitest';

import { songRow, stemsRow } from '../storage/fixtures.test-helper.ts';
import { DATA_FOLDER_CODES as CODES } from './codes.test-helper.ts';
import type { PlayerTracks } from './release.ts';
import type { DataFolderNative } from './runtime.ts';
import { createDataFolderStore } from './store.ts';

export const CARD = '1234-ABCD';
export const SONG = 4;
export const SET = 9;

export const VOLUMES: DataFolderVolumes = {
  currentVolumeUuid: null,
  currentAvailable: true,
  requiredBytes: 1_000,
  volumes: [],
};

export function status(fields: Partial<MoveStatus> = {}): MoveStatus {
  return {
    phase: 'COPYING',
    sourceVolumeUuid: null,
    targetVolumeUuid: CARD,
    doneBytes: 540,
    totalBytes: 2_400,
    doneFiles: 24,
    totalFiles: 54,
    path: null,
    running: true,
    switched: false,
    paused: false,
    awaitingRelease: false,
    error: null,
    ...fields,
  };
}

export const SWITCHED = status({ phase: 'CLEANING', switched: true });

export function rejection(code: string) {
  return Object.assign(new Error('refused'), { code });
}

export function setupStore({
  move = null,
  tracks = { song: null, stems: null },
}: { move?: MoveStatus | null; tracks?: PlayerTracks } = {}) {
  let listeners: MoveListeners | null = null;
  let playersChanged: () => void = () => undefined;
  let folderChanged: () => void = () => undefined;
  const players = { current: tracks };
  const native = {
    codes: vi.fn(() => CODES),
    listVolumes: vi.fn(() => Promise.resolve(VOLUMES)),
    startMove: vi.fn(() => Promise.resolve()),
    startCardReturn: vi.fn(() => Promise.resolve()),
    cancelMove: vi.fn(() => Promise.resolve()),
    resumeMove: vi.fn(() => Promise.resolve()),
    undoMove: vi.fn(() => Promise.resolve()),
    moveStatus: vi.fn(() => Promise.resolve(move)),
    switchToInternalStorage: vi.fn(() => Promise.resolve()),
    releaseOldCopies: vi.fn(),
    watchMove: vi.fn((next: MoveListeners) => {
      listeners = next;
      return () => undefined;
    }),
    watchDataFolder: vi.fn((listener: () => void) => {
      folderChanged = listener;
      return () => undefined;
    }),
  } satisfies DataFolderNative;
  const storedFiles = vi.fn(() =>
    Promise.resolve([
      {
        row: songRow(),
        audioPaths: ['songs/a/a.mp3'],
        waveformPaths: ['songs/a/a.kwav'],
      },
      { row: stemsRow(), audioPaths: ['stems/r/bass.flac'], waveformPaths: [] },
    ]),
  );
  const store = createDataFolderStore({
    native: () => native,
    storedFiles,
    players: {
      tracks: () => players.current,
      subscribe: (listener) => {
        playersChanged = listener;
        return () => undefined;
      },
    },
  });
  const progress = (next: MoveStatus) => {
    listeners?.progress(next);
  };
  const finish = async (finished: MoveFinished) => {
    const reads = native.moveStatus.mock.calls.length;
    listeners?.finished(finished);
    await vi.waitFor(() => {
      expect(native.moveStatus).toHaveBeenCalledTimes(reads + 1);
    });
  };
  const setTracks = (next: PlayerTracks) => {
    players.current = next;
    playersChanged();
  };
  return {
    store,
    native,
    storedFiles,
    progress,
    finish,
    setTracks,
    folderChanged: () => {
      folderChanged();
    },
  };
}
