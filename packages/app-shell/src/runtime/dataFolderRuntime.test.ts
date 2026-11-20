import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configureDataFolder: vi.fn(),
  start: vi.fn(() => Promise.resolve()),
  native: {
    cancelMove: vi.fn(),
    dataFolderCodes: vi.fn(),
    listVolumes: vi.fn(),
    moveStatus: vi.fn(),
    releaseOldCopies: vi.fn(),
    resumeMove: vi.fn(),
    startCardReturn: vi.fn(),
    startMove: vi.fn(),
    switchToInternalStorage: vi.fn(),
    undoMove: vi.fn(),
    watchDataFolder: vi.fn(),
    watchMove: vi.fn(),
  },
}));

vi.mock('@kitbag/core-native', () => mocks.native);
vi.mock('@kitbag/core-state', () => ({
  configureDataFolder: mocks.configureDataFolder,
  dataFolderStore: { getState: () => ({ start: mocks.start }) },
}));

await import('./dataFolderRuntime.ts');

const configured = mocks.configureDataFolder.mock.calls;
const starts = mocks.start.mock.calls.length;

it('wires every native move call and starts listening at launch', () => {
  expect(configured).toEqual([
    [
      {
        codes: mocks.native.dataFolderCodes,
        listVolumes: mocks.native.listVolumes,
        startMove: mocks.native.startMove,
        startCardReturn: mocks.native.startCardReturn,
        cancelMove: mocks.native.cancelMove,
        resumeMove: mocks.native.resumeMove,
        undoMove: mocks.native.undoMove,
        moveStatus: mocks.native.moveStatus,
        switchToInternalStorage: mocks.native.switchToInternalStorage,
        releaseOldCopies: mocks.native.releaseOldCopies,
        watchMove: mocks.native.watchMove,
        watchDataFolder: mocks.native.watchDataFolder,
      },
    ],
  ]);
  expect(starts).toBe(1);
});
