import type { ToolCatalogue, ToolCatalogueTool } from '@kitbag/core-native';

import { toolsOn } from './switches.ts';

export interface ToolDataUsage {
  readonly bytes: number;
  readonly items: number;
}

export type ToolDataUsageById = Readonly<Record<string, ToolDataUsage>>;

export const NO_TOOL_DATA: ToolDataUsage = { bytes: 0, items: 0 };

export interface ToolSections {
  readonly builtIn: readonly string[];
  readonly downloaded: readonly ToolCatalogueTool[];
  readonly toDownload: readonly ToolCatalogueTool[];
}

export interface ToolCounts {
  readonly on: number;
  readonly toDownload: number;
}

export function isInstalled(tool: ToolCatalogueTool): boolean {
  return tool.installedVersion !== null;
}

function downloadable(
  builtIds: readonly string[],
  catalogue: ToolCatalogue | null,
): readonly ToolCatalogueTool[] {
  return (catalogue?.tools ?? []).filter(
    (tool) => !builtIds.includes(tool.toolId),
  );
}

export function toolSections(
  builtIds: readonly string[],
  catalogue: ToolCatalogue | null,
): ToolSections {
  const tools = downloadable(builtIds, catalogue);
  return {
    builtIn: builtIds,
    downloaded: tools.filter(isInstalled),
    toDownload: tools.filter((tool) => !isInstalled(tool)),
  };
}

export function toolRoster(sections: ToolSections): readonly string[] {
  return [...sections.builtIn, ...sections.downloaded.map((t) => t.toolId)];
}

export function toolCounts(
  sections: ToolSections,
  off: readonly string[],
): ToolCounts {
  return {
    on: toolsOn(toolRoster(sections), off).length,
    toDownload: sections.toDownload.length,
  };
}

export function toolDataUsage(
  entries: readonly { readonly key: string; readonly value: string }[],
): ToolDataUsage {
  const utf8 = new TextEncoder();
  const bytes = entries.reduce(
    (sum, { key, value }) =>
      sum + utf8.encode(key).byteLength + utf8.encode(value).byteLength,
    0,
  );
  return { bytes, items: entries.length };
}

export function findTool(
  catalogue: ToolCatalogue | null,
  toolId: string,
): ToolCatalogueTool | undefined {
  return catalogue?.tools.find((tool) => tool.toolId === toolId);
}
