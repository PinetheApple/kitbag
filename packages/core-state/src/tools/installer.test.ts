import type { ToolData, ToolDataRepository } from '@kitbag/core-db';
import type { NativeToolInstaller } from '@kitbag/core-native';
import { beforeEach, expect, it, vi } from 'vitest';

import { createToolInstaller } from './installer.ts';

const ID = 'chords';

const clear = vi.fn<ToolData['clear']>();
const forTool = vi.fn<ToolDataRepository['forTool']>();
const native = {
  downloads: vi.fn(),
  setDownloads: vi.fn(),
  catalogue: vi.fn(),
  install: vi.fn<NativeToolInstaller['install']>(),
  cancel: vi.fn<NativeToolInstaller['cancel']>(),
  remove: vi.fn<NativeToolInstaller['remove']>(),
  onUpdate: vi.fn(),
} satisfies NativeToolInstaller;

function installer() {
  return createToolInstaller({ native, toolData: { forTool } });
}

beforeEach(() => {
  vi.clearAllMocks();
  forTool.mockReturnValue({ clear } as unknown as ToolData);
  clear.mockResolvedValue(undefined);
  native.remove.mockResolvedValue(undefined);
  native.install.mockResolvedValue(true);
});

it('refuses older builds unless asked', async () => {
  await installer().install(ID);
  await installer().install(ID, { allowOlder: true });

  expect(native.install.mock.calls).toEqual([
    [ID, false],
    [ID, true],
  ]);
});

it('removes the code and keeps the data by default', async () => {
  await installer().remove(ID);

  expect(native.remove).toHaveBeenCalledExactlyOnceWith(ID);
  expect(forTool).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
});

it('deletes the data only when asked, after the code is gone', async () => {
  await installer().remove(ID, { deleteData: true });

  expect(forTool).toHaveBeenCalledExactlyOnceWith(ID);
  expect(native.remove.mock.invocationCallOrder[0]).toBeLessThan(
    clear.mock.invocationCallOrder[0] ?? 0,
  );
});

it('keeps the data when removing the code fails', async () => {
  native.remove.mockRejectedValue(new Error('E_TOOL_IO'));

  await expect(installer().remove(ID, { deleteData: true })).rejects.toThrow();

  expect(clear).not.toHaveBeenCalled();
});

it("deletes a removed tool's kept data without touching its code", async () => {
  await installer().deleteData(ID);

  expect(forTool).toHaveBeenCalledExactlyOnceWith(ID);
  expect(clear).toHaveBeenCalledOnce();
  expect(native.remove).not.toHaveBeenCalled();
});
