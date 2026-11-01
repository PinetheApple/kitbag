import type { ToolsPersistence } from '@kitbag/core-state';

import type { StoredPreference } from '../runtime/storedPreference.ts';

const ON = 'true';
const OFF = 'false';

export function toolEnabledKey(toolId: string): string {
  return `tool_enabled_${toolId}`;
}

export function toolsPersistence(
  stored: (key: string) => StoredPreference,
  roster: readonly string[],
): ToolsPersistence {
  const switches = roster.map((toolId) => ({
    toolId,
    preference: stored(toolEnabledKey(toolId)),
  }));
  return {
    load: () =>
      switches
        .filter(({ preference }) => preference.read() === OFF)
        .map(({ toolId }) => toolId),
    save: (off) => {
      for (const { toolId, preference } of switches) {
        preference.write(off.includes(toolId) ? OFF : ON);
      }
    },
  };
}
