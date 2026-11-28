import type { ToolData, ToolDataRepository } from '@kitbag/core-db';
import {
  KB_TOOL_DOWNLOADS,
  KB_TOOL_INSTALL_STAGE,
  KB_TOOL_REJECTION,
  type NativeToolInstaller,
  type ToolCatalogue,
  type ToolInstallUpdate,
} from '@kitbag/core-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createToolInstallStore, INSTALL_START } from './installStore.ts';

const ID = 'recorder';
const TOTAL = 1_600_000;
const STAGE = KB_TOOL_INSTALL_STAGE;

const CATALOGUE: ToolCatalogue = {
  hostVersionName: '0.31.0',
  indexProblem: null,
  highWaterProblem: null,
  tools: [
    {
      toolId: ID,
      name: 'Practice recorder',
      icon: 'mic',
      summary: null,
      version: '0.9.0',
      sizeBytes: TOTAL,
      capabilities: [],
      installedVersion: null,
      installedManifestSha256: null,
      installedBytes: 0,
      installedProblem: null,
      highWaterVersion: null,
    },
  ],
};

let listener: ((update: ToolInstallUpdate) => void) | undefined;
let clock = 0;
const list = vi.fn<ToolData['list']>();
const clear = vi.fn<ToolData['clear']>();
const forTool = vi.fn<ToolDataRepository['forTool']>();
const native = {
  downloads: vi.fn<NativeToolInstaller['downloads']>(),
  setDownloads: vi.fn<NativeToolInstaller['setDownloads']>(),
  catalogue: vi.fn<NativeToolInstaller['catalogue']>(),
  install: vi.fn<NativeToolInstaller['install']>(),
  cancel: vi.fn<NativeToolInstaller['cancel']>(),
  remove: vi.fn<NativeToolInstaller['remove']>(),
  onUpdate: vi.fn<NativeToolInstaller['onUpdate']>(),
} satisfies NativeToolInstaller;

function store() {
  return createToolInstallStore({
    native,
    toolData: { forTool },
    now: () => clock,
  });
}

function emit(
  stage: ToolInstallUpdate['stage'],
  fields: Partial<ToolInstallUpdate> = {},
) {
  listener?.({
    toolId: ID,
    stage,
    receivedBytes: 0,
    totalBytes: TOTAL,
    attempt: 1,
    failure: null,
    detail: null,
    neededBytes: 0,
    freeBytes: 0,
    ...fields,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  listener = undefined;
  clock = 0;
  native.onUpdate.mockImplementation((next) => {
    listener = next;
    return () => undefined;
  });
  native.downloads.mockResolvedValue(KB_TOOL_DOWNLOADS.on);
  native.setDownloads.mockResolvedValue(undefined);
  native.catalogue.mockResolvedValue(CATALOGUE);
  native.install.mockResolvedValue(true);
  native.remove.mockResolvedValue(undefined);
  list.mockResolvedValue([]);
  clear.mockResolvedValue(undefined);
  forTool.mockReturnValue({ list, clear } as unknown as ToolData);
});

describe('downloads switch', () => {
  it.each([KB_TOOL_DOWNLOADS.unasked, KB_TOOL_DOWNLOADS.off])(
    'sends Install to the opt-in while downloads read %s, and installs nothing',
    async (state) => {
      native.downloads.mockResolvedValue(state);
      const tools = store();
      expect(await tools.getState().install(ID)).toBe(INSTALL_START.optIn);
      expect(native.install).not.toHaveBeenCalled();
      expect(tools.getState().jobs).toEqual({});
    },
  );

  it('turns downloads on from the opt-in, then starts the install that led there', async () => {
    native.downloads.mockResolvedValueOnce(KB_TOOL_DOWNLOADS.unasked);
    const tools = store();
    await tools.getState().install(ID);
    native.downloads.mockResolvedValue(KB_TOOL_DOWNLOADS.on);

    expect(await tools.getState().turnOnFromOptIn(ID)).toBe(
      INSTALL_START.started,
    );
    expect(native.setDownloads).toHaveBeenCalledExactlyOnceWith(
      KB_TOOL_DOWNLOADS.on,
    );
    expect(native.install).toHaveBeenCalledExactlyOnceWith(ID, false);
  });

  it('turns downloads off without installing anything', async () => {
    const tools = store();
    await tools.getState().turnOff();
    expect(native.setDownloads).toHaveBeenCalledExactlyOnceWith(
      KB_TOOL_DOWNLOADS.off,
    );
    expect(tools.getState().downloads).toBe(KB_TOOL_DOWNLOADS.off);
  });

  it('never sets downloads on except from the opt-in', async () => {
    const tools = store();
    await tools.getState().refresh();
    await tools.getState().install(ID);
    await tools.getState().turnOff();
    expect(native.setDownloads).not.toHaveBeenCalledWith(KB_TOOL_DOWNLOADS.on);
  });
});

describe('install progress', () => {
  it('shows each stage as it arrives', async () => {
    const tools = store();
    await tools.getState().install(ID);
    for (const stage of [STAGE.downloading, STAGE.checking, STAGE.installing]) {
      emit(stage);
      expect(tools.getState().jobs[ID]?.stage).toBe(stage);
    }
  });

  it('coalesces a flood of byte counts into whole-percent steps', async () => {
    const tools = store();
    await tools.getState().install(ID);
    const seen = new Set<number>();
    tools.subscribe((state) => {
      const job = state.jobs[ID];
      if (job !== undefined) seen.add(job.receivedBytes);
    });
    const step = TOTAL / 1000;
    for (let i = 1; i <= 1000; i += 1)
      emit(STAGE.downloading, { receivedBytes: step * i });

    expect(seen.size).toBeLessThanOrEqual(101);
    expect(seen.size).toBeGreaterThanOrEqual(50);
    expect(tools.getState().jobs[ID]?.receivedBytes).toBe(TOTAL);
  });

  it('throttles progress with no known size by time', async () => {
    const tools = store();
    await tools.getState().install(ID);
    emit(STAGE.downloading, { totalBytes: 0, receivedBytes: 1 });
    const first = tools.getState().jobs[ID];
    emit(STAGE.downloading, { totalBytes: 0, receivedBytes: 2 });
    expect(tools.getState().jobs[ID]).toBe(first);
    clock += 100;
    emit(STAGE.downloading, { totalBytes: 0, receivedBytes: 3 });
    expect(tools.getState().jobs[ID]?.receivedBytes).toBe(3);
  });

  it('ends on the terminal event, not on the byte count', async () => {
    const tools = store();
    await tools.getState().install(ID);
    emit(STAGE.downloading, { receivedBytes: TOTAL });
    expect(tools.getState().jobs[ID]?.stage).toBe(STAGE.downloading);
    emit(STAGE.failed, {
      failure: KB_TOOL_REJECTION.signature,
      receivedBytes: TOTAL,
    });
    expect(tools.getState().jobs[ID]).toMatchObject({
      stage: STAGE.failed,
      failure: KB_TOOL_REJECTION.signature,
    });
  });

  it('ignores a late progress event after the terminal one', async () => {
    const tools = store();
    await tools.getState().install(ID);
    emit(STAGE.failed, { failure: KB_TOOL_REJECTION.offline });
    emit(STAGE.downloading, { receivedBytes: 10 });
    expect(tools.getState().jobs[ID]?.stage).toBe(STAGE.failed);
  });

  it('keeps the space numbers of a no-space failure', async () => {
    const tools = store();
    await tools.getState().install(ID);
    emit(STAGE.failed, {
      failure: KB_TOOL_REJECTION.noSpace,
      neededBytes: 4_100_000,
      freeBytes: 2_300_000,
    });
    expect(tools.getState().jobs[ID]).toMatchObject({
      neededBytes: 4_100_000,
      freeBytes: 2_300_000,
    });
  });

  it('goes back to idle when the install is cancelled', async () => {
    const tools = store();
    await tools.getState().install(ID);
    emit(STAGE.downloading, { receivedBytes: 10 });
    tools.getState().cancel(ID);
    emit(STAGE.cancelled, { failure: KB_TOOL_REJECTION.cancelled });
    expect(native.cancel).toHaveBeenCalledExactlyOnceWith(ID);
    expect(tools.getState().jobs[ID]).toBeUndefined();
  });

  it('refreshes the catalogue once the tool is installed', async () => {
    const tools = store();
    await tools.getState().install(ID);
    native.catalogue.mockClear();
    emit(STAGE.installed);
    await vi.waitFor(() => {
      expect(native.catalogue).toHaveBeenCalledOnce();
    });
  });

  it('leaves the running job alone when native is already installing it', async () => {
    const tools = store();
    await tools.getState().install(ID);
    emit(STAGE.downloading, { receivedBytes: TOTAL / 2 });
    native.install.mockResolvedValue(false);
    expect(await tools.getState().install(ID)).toBe(INSTALL_START.busy);
    expect(tools.getState().jobs[ID]?.receivedBytes).toBe(TOTAL / 2);
  });
});

describe('remove and data', () => {
  it('keeps the data by default', async () => {
    await store().getState().remove(ID);
    expect(native.remove).toHaveBeenCalledExactlyOnceWith(ID);
    expect(clear).not.toHaveBeenCalled();
  });

  it('deletes the data only after the code is removed when asked', async () => {
    await store().getState().remove(ID, { deleteData: true });
    expect(native.remove.mock.invocationCallOrder[0]).toBeLessThan(
      clear.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('keeps the data when the remove fails', async () => {
    native.remove.mockRejectedValue(new Error(KB_TOOL_REJECTION.io));
    await expect(
      store().getState().remove(ID, { deleteData: true }),
    ).rejects.toThrow();
    expect(clear).not.toHaveBeenCalled();
  });

  it('deletes kept data of a removed tool without removing anything', async () => {
    const tools = store();
    await tools.getState().deleteData(ID);
    expect(clear).toHaveBeenCalledOnce();
    expect(native.remove).not.toHaveBeenCalled();
  });

  it('reports each tool data size after a refresh', async () => {
    list.mockResolvedValue([
      { key: 'take-1', value: '"x"', updatedAt: new Date(0) },
    ]);
    const tools = store();
    expect(await tools.getState().refresh()).toBe(true);
    expect(tools.getState().data[ID]).toEqual({ bytes: 6 + 3, items: 1 });
    expect(tools.getState().catalogue).toBe(CATALOGUE);
  });

  it('keeps what it had when a refresh fails', async () => {
    const tools = store();
    await tools.getState().refresh();
    native.catalogue.mockRejectedValue(new Error(KB_TOOL_REJECTION.index));
    expect(await tools.getState().refresh()).toBe(false);
    expect(tools.getState().catalogue).toBe(CATALOGUE);
  });
});
