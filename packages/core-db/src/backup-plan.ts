import {
  CATEGORIES,
  DEFAULT_IMPORT_CATEGORIES,
  recordKey,
  referenceOf,
  REFERENCES,
  recordLabel,
  reject,
  type BackupFile,
  type BackupRecord,
  type Category,
  type Conflict,
  type ImportMode,
  type LibrarySongRecord,
  type LocalRecord,
  type Resolutions,
} from './backup-format';
import type { Snapshot } from './backup-snapshot';
import { sameStemSong } from './backup-stem-songs';
import { meterOverrideOf, NO_METER_OVERRIDE } from './meter-override';

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
  notOnDevice?: number;
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

// A version travels with its grid: it only differs from the device's when the grid
// does, and a version-only difference is not one the user can judge.
const MERGE_IGNORED_FIELDS = new Set(['active', 'analysisVersion']);

function canonical(record: BackupRecord): string {
  const fields = Object.keys(record).filter(
    (field) => !MERGE_IGNORED_FIELDS.has(field),
  );
  return JSON.stringify(record, fields.sort());
}

// A sound is its UUID: a renamed copy of the same sound is not a difference.
function sameRecord(mine: LocalRecord, theirs: BackupRecord): boolean {
  if ('slot' in mine) return 'slot' in theirs && mine.uuid === theirs.uuid;
  if ('stems' in mine) return 'stems' in theirs && sameStemSong(mine, theirs);
  return canonical(mine) === canonical(theirs);
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

function planReplace(incoming: readonly BackupRecord[], localCount: number) {
  const summary = emptyPlan(incoming.length);
  summary.new = incoming.length;
  summary.deletes = localCount;
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
  const key = recordKey(category, record);
  const conflict = { category, key, label: recordLabel(category, record) };
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
  const local = localRecords(category, snapshot);
  const state = emptyMergeState(incoming.length);
  for (const record of incoming) {
    const key = recordKey(category, record);
    const mine = local.get(key);
    if (mine === undefined) {
      state.summary.new += 1;
      state.writes.push({ record, localId: undefined });
    } else if (sameRecord(mine, record)) state.summary.unchanged += 1;
    else {
      const localId = snapshot.ids[category].get(key);
      mergeConflict(category, record, localId, resolutions, state);
    }
  }
  return state;
}

function localRecords(category: Category, snapshot: Snapshot) {
  return new Map<string, LocalRecord>(
    snapshot.records[category].map((record) => [
      recordKey(category, record),
      record,
    ]),
  );
}

// Stem songs are settings for audio already on the device: nothing is inserted
// or deleted, and a record with no stem song here is only counted.
function planStemSongs(
  mode: ImportMode,
  incoming: readonly BackupRecord[],
  snapshot: Snapshot,
  resolutions: Resolutions,
): MergeState {
  const category = 'stemSongs';
  const local = localRecords(category, snapshot);
  const state = emptyMergeState(incoming.length);
  state.summary.notOnDevice = 0;
  for (const record of incoming) {
    const key = recordKey(category, record);
    const mine = local.get(key);
    const localId = snapshot.ids[category].get(key);
    if (mine === undefined || localId === undefined)
      state.summary.notOnDevice += 1;
    else if (sameRecord(mine, record)) state.summary.unchanged += 1;
    else if (mode === 'replace') {
      state.summary.updates += 1;
      state.writes.push({ record, localId });
    } else mergeConflict(category, record, localId, resolutions, state);
  }
  return state;
}

function resolvedRef(
  uuid: string | null,
  target: Category,
  categories: readonly Category[],
  snapshot: Snapshot,
): string | null {
  if (uuid === null || categories.includes(target)) return uuid;
  return snapshot.ids[target].has(uuid) ? uuid : null;
}

function fillMissingOverrideFromDevice(
  songs: readonly LibrarySongRecord[],
  snapshot: Snapshot,
): LibrarySongRecord[] {
  const device = new Map(
    snapshot.records.librarySongs.map((song) => [song.uuid, song]),
  );
  return songs.map((song) => ({
    ...meterOverrideOf({ ...NO_METER_OVERRIDE, ...device.get(song.uuid) }),
    ...song,
  }));
}

function incomingRecords(
  category: Category,
  file: BackupFile,
  snapshot: Snapshot,
): readonly BackupRecord[] {
  return category === 'librarySongs'
    ? fillMissingOverrideFromDevice(file.records.librarySongs, snapshot)
    : file.records[category];
}

function effective(
  category: Category,
  record: BackupRecord,
  categories: readonly Category[],
  snapshot: Snapshot,
): BackupRecord {
  let resolved = record;
  for (const reference of REFERENCES) {
    if (reference.source !== category) continue;
    const uuid = referenceOf(record, reference);
    const value = resolvedRef(uuid, reference.target, categories, snapshot);
    resolved = { ...resolved, [reference.field]: value };
  }
  return resolved;
}

function planCategory(
  category: Category,
  mode: ImportMode,
  incoming: readonly BackupRecord[],
  snapshot: Snapshot,
  resolutions: Resolutions,
): MergeState {
  if (category === 'stemSongs')
    return planStemSongs(mode, incoming, snapshot, resolutions);
  if (mode === 'replace')
    return planReplace(incoming, snapshot.records[category].length);
  return planMerge(category, incoming, snapshot, resolutions);
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
    const incoming = incomingRecords(category, file, snapshot).map((record) =>
      effective(category, record, categories, snapshot),
    );
    const result = planCategory(
      category,
      mode,
      incoming,
      snapshot,
      resolutions,
    );
    plan.counts[category] = result.summary;
    plan.unresolved.push(...result.unresolved);
    writes[category] = result.writes;
  }
  return { plan, writes };
}

export function planFingerprint(plan: ImportPlan): string {
  return JSON.stringify([plan.mode, plan.categories, plan.counts]);
}
