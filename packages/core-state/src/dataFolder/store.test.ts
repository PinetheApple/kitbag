import type {
  DataFolderVolumes,
  MoveFinished,
  MoveListeners,
  MoveStatus,
} from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { songRow, stemsRow } from '../storage/fixtures.test-helper.ts';
import { DATA_FOLDER_CODES as CODES } from './codes.test-helper.ts';
import type { PlayerTracks } from './release.ts';
import type { DataFolderNative } from './runtime.ts';
import {
  createDataFolderStore,
  folderUnavailable,
  pausedMove,
} from './store.ts';

const CARD = '1234-ABCD';
const SONG = 4;
const SET = 9;

const VOLUMES: DataFolderVolumes = {
  currentVolumeUuid: null,
  currentAvailable: true,
  requiredBytes: 1_000,
  volumes: [],
};

function status(fields: Partial<MoveStatus> = {}): MoveStatus {
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

const SWITCHED = status({ phase: 'CLEANING', switched: true });

function rejection(code: string) {
  return Object.assign(new Error('refused'), { code });
}

function setup({
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
      { row: songRow(), audioPaths: ['songs/a/a.mp3'] },
      { row: stemsRow(), audioPaths: ['stems/r/bass.flac'] },
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
    listeners?.finished(finished);
    await vi.waitFor(() => {
      expect(native.moveStatus).toHaveBeenCalledTimes(2);
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

describe('dataFolderStore events', () => {
  it('loads codes, the move and the volumes on start', async () => {
    const { store } = setup({ move: status() });
    await store.getState().start();
    expect(store.getState()).toMatchObject({
      codes: CODES,
      move: status(),
      volumes: VOLUMES,
    });
  });

  it('follows progress events', async () => {
    const { store, progress } = setup();
    await store.getState().start();
    const later = status({ doneBytes: 1_200, doneFiles: 30 });
    progress(later);
    expect(store.getState().move).toBe(later);
  });

  it('keeps a failed move error and rereads the move once it finishes', async () => {
    const { store, native, finish } = setup();
    await store.getState().start();
    const finished = {
      outcome: 'failed',
      error: CODES.moveErrors.hashMismatch,
      path: 'songs/a/a.mp3',
    };
    native.moveStatus.mockResolvedValue(
      status({ running: false, paused: true, error: finished.error }),
    );
    await finish(finished);
    expect(store.getState()).toMatchObject({
      finished,
      error: CODES.moveErrors.hashMismatch,
    });
    expect(store.getState().move?.paused).toBe(true);
  });

  it('rereads the volumes when the data folder changes', async () => {
    const { store, native, folderChanged } = setup();
    await store.getState().start();
    native.listVolumes.mockResolvedValue({
      ...VOLUMES,
      currentAvailable: false,
    });
    folderChanged();
    await vi.waitFor(() => {
      expect(folderUnavailable(store.getState())).toBe(true);
    });
  });
});

describe('paused move', () => {
  it('offers a move the app was killed in', async () => {
    const killed = status({ running: false, paused: true });
    const { store } = setup({ move: killed });
    await store.getState().start();
    expect(pausedMove(store.getState())).toBe(killed);
  });

  it('offers nothing for a running move or none', async () => {
    const { store, progress } = setup();
    await store.getState().start();
    expect(pausedMove(store.getState())).toBeNull();
    progress(status());
    expect(pausedMove(store.getState())).toBeNull();
  });

  it('leaves a failed move to its failure, not the closed-app banner', async () => {
    const mismatch = status({
      running: false,
      paused: true,
      error: CODES.moveErrors.hashMismatch,
    });
    const { store } = setup({ move: mismatch });
    await store.getState().start();
    expect(pausedMove(store.getState())).toBeNull();
  });
});

describe('releasing the old copies', () => {
  it('releases at once when no player was open at the switch', async () => {
    const { store, native, progress } = setup();
    await store.getState().start();
    progress(SWITCHED);
    expect(native.releaseOldCopies).toHaveBeenCalledOnce();
  });

  it('never releases before the switch', async () => {
    const { store, native, progress } = setup();
    await store.getState().start();
    progress(status({ phase: 'CATCH_UP' }));
    expect(native.releaseOldCopies).not.toHaveBeenCalled();
  });

  it('waits for both players to let go of what they held at the switch', async () => {
    const { store, native, progress, setTracks } = setup({
      tracks: { song: SONG, stems: SET },
    });
    await store.getState().start();
    progress(SWITCHED);
    setTracks({ song: null, stems: SET });
    expect(native.releaseOldCopies).not.toHaveBeenCalled();
    setTracks({ song: SONG, stems: null });
    expect(native.releaseOldCopies).toHaveBeenCalledOnce();
  });

  it('waits for the stem player alone', async () => {
    const { store, native, progress, setTracks } = setup({
      tracks: { song: null, stems: SET },
    });
    await store.getState().start();
    progress(SWITCHED);
    expect(native.releaseOldCopies).not.toHaveBeenCalled();
    setTracks({ song: null, stems: null });
    expect(native.releaseOldCopies).toHaveBeenCalledOnce();
  });

  it('releases once per switch however many events follow', async () => {
    const { store, native, progress } = setup();
    await store.getState().start();
    progress(SWITCHED);
    progress(
      status({
        phase: 'CLEANING',
        switched: true,
        running: false,
        awaitingRelease: true,
      }),
    );
    expect(native.releaseOldCopies).toHaveBeenCalledOnce();
  });

  it('releases a clean-up still waiting when the app starts', async () => {
    const waiting = status({
      phase: 'CLEANING',
      switched: true,
      running: false,
      awaitingRelease: true,
    });
    const { store, native } = setup({ move: waiting });
    await store.getState().start();
    expect(native.releaseOldCopies).toHaveBeenCalledOnce();
  });

  it('releases again for a second move after the first one finished', async () => {
    const { store, native, progress, finish } = setup();
    await store.getState().start();
    progress(SWITCHED);
    native.moveStatus.mockResolvedValue(null);
    await finish({ outcome: CODES.moveOutcomes.done, error: null, path: null });
    expect(store.getState().move).toBeNull();

    progress(SWITCHED);
    expect(native.releaseOldCopies).toHaveBeenCalledTimes(2);
  });
});

describe('requests', () => {
  it('switches to internal storage with every stored audio path as away', async () => {
    const { store, native } = setup();
    await store.getState().start();
    await store.getState().switchToInternalStorage();
    expect(native.switchToInternalStorage).toHaveBeenCalledExactlyOnceWith([
      'songs/a/a.mp3',
      'stems/r/bass.flac',
    ]);
  });

  it('keeps a refusal code to show', async () => {
    const { store, native } = setup();
    await store.getState().start();
    native.startMove.mockRejectedValue(
      rejection(CODES.moveErrors.targetOccupied),
    );
    await store.getState().startMove(CARD);
    expect(store.getState().error).toBe(CODES.moveErrors.targetOccupied);
    store.getState().dismissError();
    expect(store.getState().error).toBeNull();
  });

  it('names an unexplained failure as an i/o error', async () => {
    const { store, native } = setup();
    await store.getState().start();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    native.undoMove.mockRejectedValue(new Error('bridge gone'));
    await store.getState().undoMove();
    expect(store.getState().error).toBe(CODES.moveErrors.io);
  });
});
