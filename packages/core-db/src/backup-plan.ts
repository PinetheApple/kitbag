import {
  CATEGORIES,
  DEFAULT_IMPORT_CATEGORIES,
  recordKey,
  recordLabel,
  reject,
  type BackupFile,
  type BackupRecord,
  type Category,
  type Conflict,
  type ImportMode,
  type Resolutions,
} from './backup-format';
import type { Snapshot } from './backup-snapshot';

export interface ImportOptions {
  mode?: ImportMode;
  categories?: readonly Category[];
  resolutions?: Resolutions;
}

export interface CategoryPlan {
  incoming: number;
  new: number;
  unchanged: number;
  updates: number;
  conflicts: Conflict[];
  deletes: number;
}

export interface ImportPlan {
  mode: ImportMode;
  categories: Category[];
  counts: Partial<Record<Category, CategoryPlan>>;
  unresolved: Conflict[];
  file: BackupFile;
  resolutions: Resolutions;
}

export interface Write {
  record: BackupRecord;
  localId: number | undefined;
}

export type Writes = Partial<Record<Category, Write[]>>;

function canonical(record: BackupRecord, mode: ImportMode): string {
  const copy: Record<string, unknown> = { ...record };
  if (mode === 'merge') delete copy.active;
  return JSON.stringify(copy, Object.keys(copy).sort());
}

function selectCategories(
  file: BackupFile,
  mode: ImportMode,
  requested: readonly Category[] | undefined,
): Category[] {
  const selected = requested
    ? CATEGORIES.filter((category) => requested.includes(category))
    : CATEGORIES.filter(
        (category) =>
          DEFAULT_IMPORT_CATEGORIES.includes(category) &&
          file.categories.includes(category),
      );
  for (const category of selected)
    if (!file.categories.includes(category))
      reject({ kind: 'categoryNotInFile', category });
  const has = (category: Category) => selected.includes(category);
  if (has('setlists') && !has('songPresets'))
    reject({
      kind: 'missingDependency',
      category: 'setlists',
      requires: 'songPresets',
    });
  if (mode === 'replace' && has('songPresets') && !has('setlists'))
    reject({
      kind: 'missingDependency',
      category: 'songPresets',
      requires: 'setlists',
    });
  return selected;
}

function emptyPlan(incoming: number): CategoryPlan {
  return {
    incoming,
    new: 0,
    unchanged: 0,
    updates: 0,
    conflicts: [],
    deletes: 0,
  };
}

function planReplace(
  incoming: readonly BackupRecord[],
  local: readonly BackupRecord[],
) {
  const summary = emptyPlan(incoming.length);
  summary.new = incoming.length;
  summary.deletes = local.length;
  const writes = incoming.map((record) => ({ record, localId: undefined }));
  return { summary, writes, unresolved: [] as Conflict[] };
}

interface MergeState {
  summary: CategoryPlan;
  writes: Write[];
  unresolved: Conflict[];
}

function emptyMergeState(incoming: number): MergeState {
  return { summary: emptyPlan(incoming), writes: [], unresolved: [] };
}

function mergeConflict(
  category: Category,
  record: BackupRecord,
  localId: number | undefined,
  resolutions: Resolutions,
  state: MergeState,
) {
  const key = recordKey(record);
  const conflict = { category, key, label: recordLabel(record) };
  state.summary.conflicts.push(conflict);
  const resolution = resolutions[category]?.[key];
  if (resolution === undefined) state.unresolved.push(conflict);
  if (resolution !== 'theirs') return;
  state.summary.updates += 1;
  state.writes.push({ record, localId });
}

function planMerge(
  category: Category,
  incoming: readonly BackupRecord[],
  snapshot: Snapshot,
  resolutions: Resolutions,
): MergeState {
  const local = new Map(
    snapshot.records[category].map((record) => [recordKey(record), record]),
  );
  const state = emptyMergeState(incoming.length);
  for (const record of incoming) {
    const key = recordKey(record);
    const mine = local.get(key);
    if (mine === undefined) {
      state.summary.new += 1;
      state.writes.push({ record, localId: undefined });
    } else if (canonical(mine, 'merge') === canonical(record, 'merge'))
      state.summary.unchanged += 1;
    else {
      const localId = snapshot.ids[category].get(key);
      mergeConflict(category, record, localId, resolutions, state);
    }
  }
  return state;
}

export function computePlan(
  file: BackupFile,
  snapshot: Snapshot,
  options: ImportOptions,
): { plan: ImportPlan; writes: Writes } {
  const mode = options.mode ?? 'merge';
  const resolutions = options.resolutions ?? {};
  const categories = selectCategories(file, mode, options.categories);
  const plan: ImportPlan = {
    ...{ mode, categories, file, resolutions },
    ...{ counts: {}, unresolved: [] },
  };
  const writes: Writes = {};
  for (const category of categories) {
    const incoming = file.records[category];
    const result =
      mode === 'replace'
        ? planReplace(incoming, snapshot.records[category])
        : planMerge(category, incoming, snapshot, resolutions);
    plan.counts[category] = result.summary;
    plan.unresolved.push(...result.unresolved);
    writes[category] = result.writes;
  }
  return { plan, writes };
}

export function planFingerprint(plan: ImportPlan): string {
  return JSON.stringify([plan.mode, plan.categories, plan.counts]);
}
