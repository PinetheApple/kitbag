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
  type FileContext,
  type SoundOutcome,
} from './backup-apply';
import { parseBackup } from './backup-parse';
import {
  computePlan,
  planFingerprint,
  type CategoryPlan,
  type ImportOptions,
  type ImportPlan,
} from './backup-plan';
import { loadSnapshot } from './backup-snapshot';
import { portableStemSong } from './backup-stem-songs';
import { loadToolDataSection } from './backup-tool-data';
import type { ClickSoundFiles } from './click-sound-files';
import type { DatabaseHandle } from './repository';

export interface ApplyOptions {
  confirmReplace?: boolean;
}

export interface ApplyReport extends SoundOutcome {
  counts: Partial<Record<Category, CategoryPlan>>;
}

async function asResult<T>(work: () => Promise<T>): Promise<ImportResult<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    if (error instanceof ImportRejected)
      return { ok: false, error: error.failure };
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { kind: 'databaseError', reason } };
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
  if (file.toolData !== undefined) out.toolData = file.toolData;
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
  const toolData = await loadToolDataSection(db);
  const categories = withDependencies(requested);
  return serializeBackup({
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories,
    records: await withAudio(records, files, categories),
    ...(toolData === undefined ? {} : { toolData }),
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

const revalidated = (file: BackupFile) => parseBackup(serializeBackup(file));

async function applyPlan(
  { db }: DatabaseHandle,
  fileContext: FileContext,
  plan: ImportPlan,
  options: ApplyOptions,
): Promise<ApplyReport> {
  if (plan.mode === 'replace' && options.confirmReplace !== true)
    throw new ImportRejected({ kind: 'replaceNotConfirmed' });
  if (plan.unresolved.length > 0)
    throw new ImportRejected({
      kind: 'unresolvedConflicts',
      conflicts: plan.unresolved,
    });
  const file = revalidated(plan.file);
  const snapshot = await loadSnapshot(db);
  const fresh = computePlan(file, snapshot, plan);
  if (planFingerprint(fresh.plan) !== planFingerprint(plan))
    throw new ImportRejected({ kind: 'stalePlan' });
  const sounds = await applyWrites(
    db,
    fresh.plan,
    fresh.writes,
    snapshot,
    fileContext,
  );
  return { counts: fresh.plan.counts, ...sounds };
}

async function removeAll(files: ClickSoundFiles, fileNames: string[]) {
  await Promise.allSettled(fileNames.map((fileName) => files.remove(fileName)));
}

export function createBackupService(
  handle: DatabaseHandle,
  files: ClickSoundFiles,
) {
  const { serial, transaction } = handle.transactor;
  const apply = async (plan: ImportPlan, options: ApplyOptions = {}) => {
    const log: ClickSoundFileLog = { written: [], replaced: [] };
    const result = await asResult(() =>
      transaction(() => applyPlan(handle, { files, log }, plan, options)),
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
              parseBackup(input),
              await loadSnapshot(handle.db),
              options,
            ).plan,
        ),
      ),
    apply,
  };
}

export type BackupService = ReturnType<typeof createBackupService>;
