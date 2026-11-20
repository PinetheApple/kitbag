import { beforeEach, expect, it, vi } from 'vitest';

import type { MoveFinished, MoveStatus } from './NativeKitbagLibrary';

const library = vi.hoisted(() => ({
  getConstants: vi.fn(),
  startMove: vi.fn(),
  startCardReturn: vi.fn(),
  useInternalStorage: vi.fn(),
  releaseOldCopies: vi.fn(),
  onMoveProgress: vi.fn(),
  onMoveFinished: vi.fn(),
}));

vi.mock('./NativeKitbagLibrary', () => ({
  getKitbagLibrary: () => library,
}));

const {
  dataFolderCodes,
  releaseOldCopies,
  startCardReturn,
  startMove,
  switchToInternalStorage,
  watchMove,
} = await import('./dataFolder.ts');

beforeEach(() => {
  vi.clearAllMocks();
});

it('hands the target volume to native, null meaning internal storage', async () => {
  library.startMove.mockResolvedValue(undefined);
  await startMove(null);
  await startMove('1234-ABCD');
  expect(library.startMove.mock.calls).toEqual([[null], ['1234-ABCD']]);
});

it('hands the returned card to native', async () => {
  library.startCardReturn.mockResolvedValue(undefined);
  await startCardReturn('1234-ABCD');
  expect(library.startCardReturn).toHaveBeenCalledExactlyOnceWith('1234-ABCD');
});

it('passes the away paths and the release through unchanged', async () => {
  const paths = ['songs/a/x.mp3'];
  library.useInternalStorage.mockResolvedValue(undefined);
  await switchToInternalStorage(paths);
  releaseOldCopies();
  expect(library.useInternalStorage).toHaveBeenCalledExactlyOnceWith(paths);
  expect(library.releaseOldCopies).toHaveBeenCalledOnce();
});

it('reads only the move codes from the constants', () => {
  const codes = {
    moveOutcomes: { done: 'done' },
    movePhases: { preflight: 'PREFLIGHT' },
    moveErrors: { io: 'E_MOVE_IO' },
    volumeStates: { mounted: 'mounted' },
  };
  library.getConstants.mockReturnValue({ ...codes, songsDir: 'songs' });
  expect(dataFolderCodes()).toEqual(codes);
});

it('stops hearing both move events once unwatched', () => {
  const progressRemove = vi.fn();
  const finishedRemove = vi.fn();
  library.onMoveProgress.mockReturnValue({ remove: progressRemove });
  library.onMoveFinished.mockReturnValue({ remove: finishedRemove });
  const listeners = {
    progress: vi.fn<(status: MoveStatus) => void>(),
    finished: vi.fn<(finished: MoveFinished) => void>(),
  };

  const stop = watchMove(listeners);
  expect(library.onMoveProgress).toHaveBeenCalledExactlyOnceWith(
    listeners.progress,
  );
  expect(library.onMoveFinished).toHaveBeenCalledExactlyOnceWith(
    listeners.finished,
  );
  stop();
  expect(progressRemove).toHaveBeenCalledOnce();
  expect(finishedRemove).toHaveBeenCalledOnce();
});
