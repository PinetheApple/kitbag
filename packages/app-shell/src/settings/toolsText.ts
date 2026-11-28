import { KB_TOOL_DOWNLOADS } from '@kitbag/core-native';
import {
  switchTool,
  TOOL_SWITCH,
  type ToolCounts,
  type ToolDataUsage,
} from '@kitbag/core-state';
import type { ToolCatalogueTool } from '@kitbag/core-native';

import { formatBytes } from './bytes.ts';
import { SEPARATOR } from './separator.ts';

export const TOOLS_TITLE = 'Tools';
export const TOOLS_INTRO =
  'Turn a tool off to hide it everywhere. Nothing is deleted.';
export const TOOLS_NOTE =
  'Choose Home tiles with Edit on Home. Other tools are under More tools.';
export const LAST_ON_REASON =
  'One tool stays on, so Home has something to open.';
export const BUILT_IN_LABEL = 'Built in';
export const DOWNLOADED_LABEL = 'Downloaded';
export const TO_DOWNLOAD_LABEL = 'To download';
export const DOWNLOADS_OFF_NOTE =
  'Tool downloads are off. These tools are not on this phone. Turn on downloads to install one.';

const NOT_INSTALLED = 'Not installed';

export function joined(...parts: readonly string[]): string {
  return parts.join(` ${SEPARATOR} `);
}

export function toolsRowSummary(
  counts: ToolCounts,
  downloads: KB_TOOL_DOWNLOADS | null,
): string {
  const on = `${String(counts.on)} on`;
  return downloads === KB_TOOL_DOWNLOADS.on
    ? joined(on, `${String(counts.toDownload)} to download`)
    : on;
}

export function downloadedSubtitle(tool: ToolCatalogueTool): string {
  return joined(tool.installedVersion ?? '', formatBytes(tool.installedBytes));
}

export function toDownloadSubtitle(
  tool: ToolCatalogueTool,
  data: ToolDataUsage,
): string {
  const size = formatBytes(tool.sizeBytes);
  if (data.items > 0)
    return joined(size, NOT_INSTALLED, `data kept, ${formatBytes(data.bytes)}`);
  return tool.summary === null ? size : joined(size, tool.summary);
}

export function toolName(tool: ToolCatalogueTool): string {
  return tool.name ?? tool.toolId;
}

export function removedNotice(name: string, dataKept: boolean): string {
  return dataKept ? `${name} removed. Its data is kept.` : `${name} removed.`;
}

export interface ToolSwitchStep {
  readonly off: readonly string[];
  readonly note: string;
}

export function toolSwitchStep(
  off: readonly string[],
  roster: readonly string[],
  toolId: string,
  on: boolean,
): ToolSwitchStep {
  const result = switchTool(off, roster, toolId, on);
  return {
    off: result.off,
    note: result.outcome === TOOL_SWITCH.lastOn ? LAST_ON_REASON : TOOLS_NOTE,
  };
}
