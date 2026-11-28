import { beforeEach, expect, it, vi } from 'vitest';

import {
  KB_TOOL_DOWNLOADS,
  KB_TOOL_INSTALL_STAGE,
  KB_TOOL_REJECTION,
} from './generated/nativeConstants.gen.ts';
import type { ToolInstallEvent } from './NativeKitbagTools';
import type { ToolInstallUpdate } from './toolInstaller.ts';

const remove = vi.fn();
const tools = vi.hoisted(() => ({
  toolDownloads: vi.fn(),
  setToolDownloads: vi.fn(),
  toolCatalogue: vi.fn(),
  installTool: vi.fn(),
  cancelToolInstall: vi.fn(),
  removeTool: vi.fn(),
  onToolInstall: vi.fn(),
}));

vi.mock('./NativeKitbagTools', () => ({ getKitbagTools: () => tools }));

const { nativeToolInstaller } = await import('./toolInstaller.ts');

const EVENT: ToolInstallEvent = {
  toolId: 'chords',
  stage: KB_TOOL_INSTALL_STAGE.failed,
  receivedBytes: 0,
  totalBytes: 0,
  attempt: 0,
  failure: KB_TOOL_REJECTION.offline,
  detail: null,
  neededBytes: 0,
  freeBytes: 0,
};

let native: ((event: ToolInstallEvent) => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  native = undefined;
  tools.onToolInstall.mockImplementation(
    (listener: (event: ToolInstallEvent) => void) => {
      native = listener;
      return { remove };
    },
  );
});

it('asks native to install with only the id and the older-build choice', async () => {
  tools.installTool.mockResolvedValue(true);

  await expect(nativeToolInstaller().install('chords', true)).resolves.toBe(
    true,
  );

  expect(tools.installTool).toHaveBeenCalledExactlyOnceWith('chords', true);
});

it('reads the downloads switch as a generated state and refuses an unknown one', async () => {
  tools.toolDownloads.mockResolvedValueOnce(KB_TOOL_DOWNLOADS.off);
  tools.toolDownloads.mockResolvedValueOnce('maybe');

  await expect(nativeToolInstaller().downloads()).resolves.toBe(
    KB_TOOL_DOWNLOADS.off,
  );
  await expect(nativeToolInstaller().downloads()).rejects.toThrow('maybe');
});

it('passes known install events on, drops unknown ones, and unsubscribes', () => {
  const listener = vi.fn<(update: ToolInstallUpdate) => void>();
  const unsubscribe = nativeToolInstaller().onUpdate(listener);

  native?.(EVENT);
  native?.({ ...EVENT, stage: 'TOOL_STAGE_DANCING' });
  native?.({ ...EVENT, failure: 'E_TOOL_GREMLINS' });
  unsubscribe();

  expect(listener).toHaveBeenCalledExactlyOnceWith(EVENT);
  expect(remove).toHaveBeenCalledOnce();
});
