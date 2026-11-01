export const TOOL_SWITCH = {
  switched: 'switched',
  unchanged: 'unchanged',
  lastOn: 'lastOn',
} as const;

export type ToolSwitch = (typeof TOOL_SWITCH)[keyof typeof TOOL_SWITCH];

export interface ToolSwitchResult {
  readonly outcome: ToolSwitch;
  readonly off: readonly string[];
}

// An all-off set can only come from storage edited outside the app; Home
// needs a tool, so it reads as all on.
export function toolsOn(
  roster: readonly string[],
  off: readonly string[],
): readonly string[] {
  const on = roster.filter((toolId) => !off.includes(toolId));
  return on.length === 0 ? roster : on;
}

export function switchTool(
  off: readonly string[],
  roster: readonly string[],
  toolId: string,
  on: boolean,
): ToolSwitchResult {
  const isOff = off.includes(toolId);
  if (!roster.includes(toolId) || isOff !== on) {
    return { outcome: TOOL_SWITCH.unchanged, off };
  }
  if (on) {
    return {
      outcome: TOOL_SWITCH.switched,
      off: off.filter((id) => id !== toolId),
    };
  }
  const stillOn = toolsOn(roster, off).filter((id) => id !== toolId);
  if (stillOn.length === 0) return { outcome: TOOL_SWITCH.lastOn, off };
  return { outcome: TOOL_SWITCH.switched, off: [...off, toolId] };
}
