import {
  TOOL_DATA_CATEGORY,
  type Conflict,
  type ImportMode,
  type Resolutions,
} from './backup-format';
import type { CategoryPlan } from './backup-plan';
import { toolDataKey, type ToolDataRecord } from './backup-tool-data';

export interface MergeState<W> {
  summary: CategoryPlan;
  writes: W[];
  unresolved: Conflict[];
}

export function emptyPlan(incoming: number): CategoryPlan {
  return {
    incoming,
    new: 0,
    unchanged: 0,
    updates: 0,
    conflicts: [],
    deletes: 0,
  };
}

export function emptyMergeState<W>(incoming: number): MergeState<W> {
  return { summary: emptyPlan(incoming), writes: [], unresolved: [] };
}

export function settleConflict<W>(
  conflict: Conflict,
  write: W,
  resolutions: Resolutions,
  state: MergeState<W>,
) {
  state.summary.conflicts.push(conflict);
  const resolution = resolutions[conflict.category]?.[conflict.key];
  if (resolution === undefined) state.unresolved.push(conflict);
  if (resolution !== 'theirs') return;
  state.summary.updates += 1;
  state.writes.push(write);
}

export function planToolData(
  mode: ImportMode,
  incoming: readonly ToolDataRecord[],
  local: readonly ToolDataRecord[],
  resolutions: Resolutions,
): MergeState<ToolDataRecord> {
  const state = emptyMergeState<ToolDataRecord>(incoming.length);
  if (mode === 'replace') {
    state.summary.new = incoming.length;
    state.summary.deletes = local.length;
    state.writes.push(...incoming);
    return state;
  }
  const mine = new Map(local.map((record) => [toolDataKey(record), record]));
  for (const record of incoming) {
    const key = toolDataKey(record);
    const existing = mine.get(key);
    if (existing === undefined) {
      state.summary.new += 1;
      state.writes.push(record);
    } else if (existing.value === record.value) state.summary.unchanged += 1;
    else {
      const conflict: Conflict = {
        category: TOOL_DATA_CATEGORY,
        key,
        label: key,
      };
      settleConflict(conflict, record, resolutions, state);
    }
  }
  return state;
}
