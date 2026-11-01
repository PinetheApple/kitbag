import { toolsOn, useTools } from '@kitbag/core-state';
import { useMemo } from 'react';

import { BUILT_TOOL_IDS, type ToolOnTest } from './registry.ts';

export function toolOnTest(off: readonly string[]): ToolOnTest {
  const on = toolsOn(BUILT_TOOL_IDS, off);
  return (toolId) => !BUILT_TOOL_IDS.includes(toolId) || on.includes(toolId);
}

export function useToolOn(): ToolOnTest {
  const off = useTools((s) => s.off);
  return useMemo(() => toolOnTest(off), [off]);
}
