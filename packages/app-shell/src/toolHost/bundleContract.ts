import type { RegisterTool } from '@kitbag/core-plugin-api';

export const TOOL_REGISTRY_KEY = '__kitbagTools';
export const TOOL_ENTRY_EXPORT = 'register';

export interface ToolRegistry {
  readonly module: (specifier: string) => unknown;
  readonly register: (id: string, register: RegisterTool) => void;
}

export function toolGlobalPrefix(id: string): string {
  return `__kbt_${id.replaceAll('-', '_')}_`;
}
