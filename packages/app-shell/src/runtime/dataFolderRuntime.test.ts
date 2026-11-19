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

it('wires every native move call and starts listening at launch', () => {
  expect(mocks.configureDataFolder).toHaveBeenCalledExactlyOnceWith({
    codes: mocks.native.dataFolderCodes,
    listVolumes: mocks.native.listVolumes,
    startMove: mocks.native.startMove,
    cancelMove: mocks.native.cancelMove,
    resumeMove: mocks.native.resumeMove,
    undoMove: mocks.native.undoMove,
    moveStatus: mocks.native.moveStatus,
    switchToInternalStorage: mocks.native.switchToInternalStorage,
    releaseOldCopies: mocks.native.releaseOldCopies,
    watchMove: mocks.native.watchMove,
    watchDataFolder: mocks.native.watchDataFolder,
  });
  expect(mocks.start).toHaveBeenCalledOnce();
});
