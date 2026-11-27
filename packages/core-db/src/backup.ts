import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CATEGORIES,
  ImportRejected,
  type BackupFile,
  type Category,
  type CategoryRecords,
  type ImportResult,
  type LocalRecords,
} from './backup-format';
import {
  applyWrites,
  type ClickSoundFileLog,
  type SoundOutcome,
} from './backup-apply';
import { keepBeforeReplace, readBeforeReplace } from './backup-before-replace';
import { parseBackup } from './backup-parse';
import type { BackupRules } from './backup-rules';
import {
  computePlan,
  planFingerprint,
  type CategoryPlan,
  type ImportOptions,
  type ImportPlan,
} from './backup-plan';
import { loadSnapshot } from './backup-snapshot';
import { portableStemSong } from './backup-stem-songs';
import type { ClickSoundFiles } from './click-sound-files';
import type { DatabaseHandle } from './repository';

export interface ApplyOptions {
  confirmReplace?: boolean;
}

export interface ApplyReport extends SoundOutcome {
  counts: Partial<Record<Category, CategoryPlan>>;
}

const reasonOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

async function asResult<T>(work: () => Promise<T>): Promise<ImportResult<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    if (error instanceof ImportRejected)
      return { ok: false, error: error.failure };
    return {
      ok: false,
      error: { kind: 'databaseError', reason: reasonOf(error) },
    };
  }
}

export function serializeBackup(file: BackupFile): string {
  const out: Record<string, unknown> = {
    format: BACKUP_FORMAT,
    version: file.version,
    exportedAt: file.exportedAt,
    categories: file.categories,
  };
  for (const category of file.categories)
    out[category] = file.records[category];
  return JSON.stringify(out);
}

function withDependencies(categories: readonly Category[]): Category[] {
  const needsPresets = categories.includes('setlists');
  return CATEGORIES.filter(
    (category) =>
      categories.includes(category) ||
      (needsPresets && category === 'songPresets'),
  );
}

async function withAudio(
  records: LocalRecords,
  files: ClickSoundFiles,
  categories: readonly Category[],
): Promise<CategoryRecords> {
  const local = categories.includes('clickSounds') ? records.clickSounds : [];
  const clickSounds = await Promise.all(
    local.map(async ({ fileName, ...sound }) => ({
      ...sound,
      wav: await files.read(fileName),
    })),
  );
  return {
    ...records,
    clickSounds,
    stemSongs: records.stemSongs.map(portableStemSong),
  };
}

async function exportBackup(
  { db }: DatabaseHandle,
  files: ClickSoundFiles,
  requested: readonly Category[],
): Promise<string> {
  const { records } = await loadSnapshot(db);
  const categories = withDependencies(requested);
  return serializeBackup({
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories,
    records: await withAudio(records, files, categories),
  });
}

async function exportSetlist(
  { db }: DatabaseHandle,
  setlistUuid: string,
): Promise<string> {
  const { records } = await loadSnapshot(db);
  const setlist = records.setlists.find(({ uuid }) => uuid === setlistUuid);
  if (setlist === undefined) throw new Error(`Setlist ${setlistUuid} missing`);
  const listed = new Set(setlist.presetUuids);
  return serializeBackup({
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories: withDependencies(['setlists']),
    records: {
      ...records,
      clickSounds: [],
      stemSongs: [],
      setlists: [{ ...setlist, active: false }],
      songPresets: records.songPresets.filter(({ uuid }) => listed.has(uuid)),
    },
  });
}

async function summary({ db }: DatabaseHandle) {
  const { records } = await loadSnapshot(db);
  return Object.fromEntries(
    CATEGORIES.map((category) => [category, records[category].length]),
  ) as Record<Category, number>;
}

interface ServiceContext {
  handle: DatabaseHandle;
  files: ClickSoundFiles;
  rules: BackupRules;
}

async function keepCurrentData({ handle, files }: ServiceContext) {
  try {
    await keepBeforeReplace(
      handle.db,
      await exportBackup(handle, files, CATEGORIES),
    );
  } catch (error) {
    throw new ImportRejected({
      kind: 'snapshotFailed',
      reason: reasonOf(error),
    });
  }
}

async function applyPlan(
  context: ServiceContext,
  log: ClickSoundFileLog,
  plan: ImportPlan,
  options: ApplyOptions,
): Promise<ApplyReport> {
  const { handle, files, rules } = context;
  const { db } = handle;
  if (plan.mode === 'replace' && options.confirmReplace !== true)
    throw new ImportRejected({ kind: 'replaceNotConfirmed' });
  if (plan.unresolved.length > 0)
    throw new ImportRejected({
      kind: 'unresolvedConflicts',
      conflicts: plan.unresolved,
    });
  const file = parseBackup(serializeBackup(plan.file), rules);
  const snapshot = await loadSnapshot(db);
  const fresh = computePlan(file, snapshot, plan, rules.deviceRoutes);
  if (planFingerprint(fresh.plan) !== planFingerprint(plan))
    throw new ImportRejected({ kind: 'stalePlan' });
  if (plan.mode === 'replace') await keepCurrentData(context);
  const sounds = await applyWrites(
    db,
    fresh.plan,
    fresh.writes,
    snapshot,
    { files, log },
    rules.deviceRoutes,
  );
  return { counts: fresh.plan.counts, ...sounds };
}

async function removeAll(files: ClickSoundFiles, fileNames: string[]) {
  await Promise.allSettled(fileNames.map((fileName) => files.remove(fileName)));
}

export function createBackupService(
  handle: DatabaseHandle,
  files: ClickSoundFiles,
  rules: BackupRules,
) {
  const { serial, transaction } = handle.transactor;
  const context = { handle, files, rules };
  const apply = async (plan: ImportPlan, options: ApplyOptions = {}) => {
    const log: ClickSoundFileLog = { written: [], replaced: [] };
    const result = await asResult(() =>
      transaction(() => applyPlan(context, log, plan, options)),
    );
    await removeAll(files, result.ok ? log.replaced : log.written);
    return result;
  };
  return {
    summary: () => serial(() => summary(handle)),
    export: (categories: readonly Category[] = CATEGORIES) =>
      serial(() => exportBackup(handle, files, categories)),
    exportSetlist: (setlistUuid: string) =>
      serial(() => exportSetlist(handle, setlistUuid)),
    plan: (input: string, options: ImportOptions = {}) =>
      serial(() =>
        asResult(
          async () =>
            computePlan(
              parseBackup(input, rules),
              await loadSnapshot(handle.db),
              options,
              rules.deviceRoutes,
            ).plan,
        ),
      ),
    apply,
    keptBeforeReplace: () => serial(() => readBeforeReplace(handle.db)),
  };
}

export type BackupService = ReturnType<typeof createBackupService>;
