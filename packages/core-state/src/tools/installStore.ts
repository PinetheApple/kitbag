import type { ToolDataRepository } from '@kitbag/core-db';
import {
  KB_TOOL_DOWNLOADS,
  KB_TOOL_INSTALL_STAGE,
  type NativeToolInstaller,
  type ToolCatalogue,
  type ToolInstallUpdate,
} from '@kitbag/core-native';

import { configuredStore, type StoreAccess } from '../configuredStore.ts';
import { toolDataUsage, type ToolDataUsageById } from './catalogue.ts';
import { createToolInstaller } from './installer.ts';

export type ToolJob = Pick<
  ToolInstallUpdate,
  | 'stage'
  | 'receivedBytes'
  | 'totalBytes'
  | 'failure'
  | 'neededBytes'
  | 'freeBytes'
>;

export const INSTALL_START = {
  started: 'started',
  optIn: 'optIn',
  busy: 'busy',
} as const;

export type InstallStart = (typeof INSTALL_START)[keyof typeof INSTALL_START];

export interface ToolInstallRuntime {
  readonly native: NativeToolInstaller;
  readonly toolData: ToolDataRepository;
  readonly now?: () => number;
}

export interface ToolInstallStore {
  readonly downloads: KB_TOOL_DOWNLOADS | null;
  readonly catalogue: ToolCatalogue | null;
  readonly data: ToolDataUsageById;
  readonly jobs: Readonly<Record<string, ToolJob>>;
  readonly refresh: () => Promise<boolean>;
  readonly turnOnFromOptIn: (toolId?: string) => Promise<InstallStart | null>;
  readonly turnOff: () => Promise<void>;
  readonly install: (toolId: string) => Promise<InstallStart>;
  readonly cancel: (toolId: string) => void;
  readonly remove: (
    toolId: string,
    options?: { readonly deleteData?: boolean },
  ) => Promise<void>;
  readonly deleteData: (toolId: string) => Promise<void>;
  readonly dismiss: (toolId: string) => void;
}

const PROGRESS_STEP = 0.01;
const UNSIZED_PROGRESS_INTERVAL_MS = 100;

const TERMINAL: ReadonlySet<string> = new Set([
  KB_TOOL_INSTALL_STAGE.installed,
  KB_TOOL_INSTALL_STAGE.failed,
  KB_TOOL_INSTALL_STAGE.cancelled,
]);

export function isFinished(job: ToolJob): boolean {
  return TERMINAL.has(job.stage);
}

const STARTING: ToolJob = {
  stage: KB_TOOL_INSTALL_STAGE.downloading,
  receivedBytes: 0,
  totalBytes: 0,
  failure: null,
  neededBytes: 0,
  freeBytes: 0,
};

const EMPTY_CATALOGUE: ToolCatalogue = {
  hostVersionName: null,
  indexProblem: null,
  highWaterProblem: null,
  tools: [],
};

const NO_INSTALLER: ToolInstallRuntime = {
  native: {
    downloads: () => Promise.resolve(KB_TOOL_DOWNLOADS.unasked),
    setDownloads: () => Promise.resolve(),
    catalogue: () => Promise.resolve(EMPTY_CATALOGUE),
    install: () => Promise.resolve(false),
    cancel: () => undefined,
    remove: () => Promise.resolve(),
    onUpdate: () => () => undefined,
  },
  toolData: {
    forTool: () => ({
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      list: () => Promise.resolve([]),
      clear: () => Promise.resolve(),
    }),
  },
};

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function jobOf(update: ToolInstallUpdate): ToolJob {
  const { stage, receivedBytes, totalBytes, failure, neededBytes, freeBytes } =
    update;
  return { stage, receivedBytes, totalBytes, failure, neededBytes, freeBytes };
}

function movedEnough(
  shown: ToolJob,
  update: ToolInstallUpdate,
  sinceShownMs: number,
): boolean {
  if (shown.stage !== update.stage || TERMINAL.has(update.stage)) return true;
  if (update.totalBytes <= 0)
    return sinceShownMs >= UNSIZED_PROGRESS_INTERVAL_MS;
  return (
    update.receivedBytes >= update.totalBytes ||
    update.receivedBytes - shown.receivedBytes >=
      update.totalBytes * PROGRESS_STEP
  );
}

function withoutJob(
  jobs: Readonly<Record<string, ToolJob>>,
  toolId: string,
): Readonly<Record<string, ToolJob>> {
  return Object.fromEntries(
    Object.entries(jobs).filter(([id]) => id !== toolId),
  );
}

function init(
  { native, toolData, now = Date.now }: ToolInstallRuntime,
  { getState, setState }: StoreAccess<ToolInstallStore>,
): ToolInstallStore {
  const installer = createToolInstaller({ native, toolData });
  const shownAt = new Map<string, number>();

  const setJob = (toolId: string, job: ToolJob) => {
    shownAt.set(toolId, now());
    setState({ jobs: { ...getState().jobs, [toolId]: job } });
  };
  const dropJob = (toolId: string) => {
    shownAt.delete(toolId);
    setState({ jobs: withoutJob(getState().jobs, toolId) });
  };

  const refresh = async () => {
    try {
      const [downloads, catalogue] = await Promise.all([
        native.downloads(),
        native.catalogue(),
      ]);
      const usage = await Promise.all(
        catalogue.tools.map(
          async ({ toolId }) =>
            [
              toolId,
              toolDataUsage(await toolData.forTool(toolId).list()),
            ] as const,
        ),
      );
      setState({ downloads, catalogue, data: Object.fromEntries(usage) });
      return true;
    } catch {
      return false;
    }
  };

  const finish = (update: ToolInstallUpdate) => {
    if (update.stage === KB_TOOL_INSTALL_STAGE.cancelled) {
      dropJob(update.toolId);
      return;
    }
    setJob(update.toolId, jobOf(update));
    void refresh();
  };

  native.onUpdate((update) => {
    const shown = getState().jobs[update.toolId];
    if (TERMINAL.has(update.stage)) {
      finish(update);
      return;
    }
    if (shown !== undefined && TERMINAL.has(shown.stage)) return;
    const sinceShown = now() - (shownAt.get(update.toolId) ?? 0);
    if (shown === undefined || movedEnough(shown, update, sinceShown))
      setJob(update.toolId, jobOf(update));
  });

  const restore = (toolId: string, before: ToolJob | undefined) => {
    if (getState().jobs[toolId] !== STARTING) return;
    if (before === undefined) dropJob(toolId);
    else setJob(toolId, before);
  };

  // Native frees a job just after its terminal event, so a retry tapped at
  // once can read as busy; one more try on the next tick covers that.
  const accepted = async (toolId: string, afterEnd: boolean) => {
    if (await installer.install(toolId)) return true;
    if (!afterEnd) return false;
    await nextTick();
    return installer.install(toolId);
  };

  const install = async (toolId: string): Promise<InstallStart> => {
    const downloads = await native.downloads();
    setState({ downloads });
    if (downloads !== KB_TOOL_DOWNLOADS.on) return INSTALL_START.optIn;
    const before = getState().jobs[toolId];
    setJob(toolId, STARTING);
    try {
      const afterEnd = before !== undefined && isFinished(before);
      if (await accepted(toolId, afterEnd)) return INSTALL_START.started;
    } catch (error) {
      restore(toolId, before);
      throw error;
    }
    restore(toolId, before);
    return INSTALL_START.busy;
  };

  return {
    downloads: null,
    catalogue: null,
    data: {},
    jobs: {},
    refresh,
    turnOnFromOptIn: async (toolId) => {
      await native.setDownloads(KB_TOOL_DOWNLOADS.on);
      setState({ downloads: KB_TOOL_DOWNLOADS.on });
      return toolId === undefined ? null : install(toolId);
    },
    turnOff: async () => {
      await native.setDownloads(KB_TOOL_DOWNLOADS.off);
      setState({ downloads: KB_TOOL_DOWNLOADS.off });
    },
    install,
    cancel: installer.cancel,
    remove: async (toolId, options) => {
      await installer.remove(toolId, options);
      dropJob(toolId);
      await refresh();
    },
    deleteData: async (toolId) => {
      await installer.deleteData(toolId);
      await refresh();
    },
    dismiss: dropJob,
  };
}

const toolInstall = configuredStore<ToolInstallRuntime, ToolInstallStore>(
  'Tool install',
  NO_INSTALLER,
  init,
);

export const createToolInstallStore = toolInstall.create;
export const configureToolInstall = toolInstall.configure;
export const getToolInstallStore = toolInstall.get;
