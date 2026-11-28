import { iconGlyphs, type IconName } from '@kitbag/core-design';
import {
  KB_TOOL_DOWNLOADS,
  KB_TOOL_INSTALL_STAGE,
  type ToolCatalogueTool,
} from '@kitbag/core-native';
import {
  INSTALL_FAILURE,
  installFailure,
  isFinished,
  isInstalled,
  type InstallFailure,
  type ToolDataUsage,
  type ToolJob,
} from '@kitbag/core-state';

export const PAGE_DOCK = {
  install: 'install',
  optIn: 'optIn',
  downloading: 'downloading',
  checking: 'checking',
  installing: 'installing',
  done: 'done',
  retry: 'retry',
  remove: 'remove',
} as const;

export type PageDock = (typeof PAGE_DOCK)[keyof typeof PAGE_DOCK];

export const INSTALLED_CARD = 'installed';

export type PageCard =
  | typeof INSTALLED_CARD
  | Exclude<InstallFailure, typeof INSTALL_FAILURE.downloadsOff>;

export interface ToolPageModel {
  readonly installed: boolean;
  readonly card: PageCard | null;
  readonly dock: PageDock;
  readonly keptData: ToolDataUsage | null;
}

const FALLBACK_ICON: IconName = 'moreTools';

export function toolIcon(icon: string | null): IconName {
  return icon !== null && icon in iconGlyphs
    ? (icon as IconName)
    : FALLBACK_ICON;
}

const RUNNING_DOCK: Readonly<Record<string, PageDock>> = {
  [KB_TOOL_INSTALL_STAGE.downloading]: PAGE_DOCK.downloading,
  [KB_TOOL_INSTALL_STAGE.retrying]: PAGE_DOCK.downloading,
  [KB_TOOL_INSTALL_STAGE.checking]: PAGE_DOCK.checking,
  [KB_TOOL_INSTALL_STAGE.installing]: PAGE_DOCK.installing,
};

function failedPage(job: ToolJob): Pick<ToolPageModel, 'card' | 'dock'> {
  const failure = installFailure(job.failure);
  if (failure === INSTALL_FAILURE.downloadsOff)
    return { card: null, dock: PAGE_DOCK.optIn };
  if (failure === INSTALL_FAILURE.offline)
    return { card: failure, dock: PAGE_DOCK.install };
  return { card: failure, dock: PAGE_DOCK.retry };
}

function idleDock(
  tool: ToolCatalogueTool,
  downloads: KB_TOOL_DOWNLOADS | null,
): PageDock {
  if (isInstalled(tool)) return PAGE_DOCK.remove;
  return downloads === KB_TOOL_DOWNLOADS.off
    ? PAGE_DOCK.optIn
    : PAGE_DOCK.install;
}

function jobPage(
  tool: ToolCatalogueTool,
  job: ToolJob | undefined,
  downloads: KB_TOOL_DOWNLOADS | null,
): Pick<ToolPageModel, 'card' | 'dock'> {
  if (job === undefined) return { card: null, dock: idleDock(tool, downloads) };
  if (!isFinished(job))
    return {
      card: null,
      dock: RUNNING_DOCK[job.stage] ?? PAGE_DOCK.downloading,
    };
  if (job.stage === KB_TOOL_INSTALL_STAGE.installed)
    return { card: INSTALLED_CARD, dock: PAGE_DOCK.done };
  return failedPage(job);
}

export function toolPageModel(
  tool: ToolCatalogueTool,
  job: ToolJob | undefined,
  downloads: KB_TOOL_DOWNLOADS | null,
  data: ToolDataUsage,
): ToolPageModel {
  const page = jobPage(tool, job, downloads);
  const installed = isInstalled(tool) || page.card === INSTALLED_CARD;
  const running = job !== undefined && !isFinished(job);
  return {
    ...page,
    installed,
    keptData: !installed && !running && data.items > 0 ? data : null,
  };
}
