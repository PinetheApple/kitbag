import { switchTool, TOOL_SWITCH, toolsOn } from '@kitbag/core-state';

import { BUILT_TOOL_IDS } from '../home/registry.ts';

export const TOOLS_TITLE = 'Tools';
export const TOOLS_INTRO =
  'Turn a tool off to hide it everywhere. Nothing is deleted.';
export const TOOLS_NOTE =
  'Choose Home tiles with Edit on Home. Other tools are under More tools.';
export const LAST_ON_REASON =
  'One tool stays on, so Home has something to open.';

export function toolsOnSummary(off: readonly string[]): string {
  return `${String(toolsOn(BUILT_TOOL_IDS, off).length)} on`;
}

export interface ToolSwitchStep {
  readonly off: readonly string[];
  readonly note: string;
}

export function toolSwitchStep(
  off: readonly string[],
  toolId: string,
  on: boolean,
): ToolSwitchStep {
  const result = switchTool(off, BUILT_TOOL_IDS, toolId, on);
  return {
    off: result.off,
    note: result.outcome === TOOL_SWITCH.lastOn ? LAST_ON_REASON : TOOLS_NOTE,
  };
}
