import type {
  DataFolderVolumes,
  MoveFinished,
  MoveListeners,
  MoveStatus,
} from '@kitbag/core-native';
import { createDataFolderStore } from '@kitbag/core-state';
import { DATA_FOLDER_CODES as CODES } from '@kitbag/core-state/src/dataFolder/codes.test-helper.ts';
import { expect, vi } from 'vitest';

import { dataFolderSheet } from './dataFolderFlow.ts';
import { CARD, move } from './dataFolderMove.test-helper.ts';
import { createDataFolderSheetController } from './dataFolderSheetController.ts';

export const ON_PHONE: DataFolderVolumes = {
  currentVolumeUuid: null,
  currentAvailable: true,
  requiredBytes: 1_000,
  volumes: [],
};

export const ON_CARD: DataFolderVolumes = {
  ...ON_PHONE,
  currentVolumeUuid: CARD,
};

export const RUNNING = move();

interface Gate {
  readonly promise: Promise<void>;
  readonly open: () => void;
}

export function gate(): Gate {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

export const finished = (outcome: string, error: string | null = null) =>
  ({ outcome, error, path: null }) satisfies MoveFinished;

export async function setup(initial: MoveStatus | null = null) {
  let listeners: MoveListeners | null = null;
  const status = { current: initial };
  const native = {
    codes: () => CODES,
    listVolumes: vi.fn(() => Promise.resolve(ON_PHONE)),
    startMove: vi.fn(() => Promise.resolve()),
    startCardReturn: vi.fn(() => Promise.resolve()),
    cancelMove: vi.fn(() => Promise.resolve()),
    resumeMove: vi.fn(() => Promise.resolve()),
    undoMove: vi.fn(() => Promise.resolve()),
    moveStatus: vi.fn(() => Promise.resolve(status.current)),
    switchToInternalStorage: vi.fn(() => Promise.resolve()),
    releaseOldCopies: vi.fn(),
    watchMove: (next: MoveListeners) => {
      listeners = next;
      return () => undefined;
    },
    watchDataFolder: () => () => undefined,
  };
  const store = createDataFolderStore({
    native: () => native,
    storedFiles: () => Promise.resolve([]),
    players: {
      tracks: () => ({ song: null, stems: null }),
      subscribe: () => () => undefined,
    },
  });
  await store.getState().start();
  const notices: string[] = [];
  const controller = createDataFolderSheetController(store, (text) => {
    notices.push(text);
  });
  controller.subscribe(() => undefined);
  const sheet = () => {
    const { move: moving, error, volumes } = store.getState();
    const returning = controller.returning();
    return dataFolderSheet(
      { move: moving, error, volumes, returning },
      controller.step(),
    ).kind;
  };
  const emit = {
    progress: (next: MoveStatus) => {
      status.current = next;
      listeners?.progress(next);
    },
    finished: (done: MoveFinished, after: MoveStatus | null = null) => {
      status.current = after;
      listeners?.finished(done);
    },
  };
  const settle = () =>
    vi.waitFor(() => {
      expect(store.getState().pending).toBe(false);
    });
  return { store, native, controller, notices, sheet, emit, settle, status };
}
