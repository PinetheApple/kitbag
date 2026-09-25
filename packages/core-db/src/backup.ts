import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CATEGORIES,
  ImportRejected,
  type Category,
  type Result,
} from './backup-format';
import { applyWrites } from './backup-apply';
import { parseBackup } from './backup-parse';
import {
  computePlan,
  planFingerprint,
  type CategoryPlan,
  type ImportOptions,
  type ImportPlan,
} from './backup-plan';
import { loadSnapshot } from './backup-snapshot';
import type { DatabaseHandle } from './repository';

export interface ApplyOptions {
  confirmReplace?: boolean;
}

async function captured<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    if (error instanceof ImportRejected)
      return { ok: false, error: error.failure };
    throw error;
  }
}

async function exportBackup(
  { db }: DatabaseHandle,
  categories: readonly Category[],
): Promise<string> {
  const { records } = await loadSnapshot(db);
  const listed = CATEGORIES.filter((category) => categories.includes(category));
  const file: Record<string, unknown> = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories: listed,
  };
  for (const category of listed) file[category] = records[category];
  return JSON.stringify(file);
}

async function summary({ db }: DatabaseHandle) {
  const { records } = await loadSnapshot(db);
  return Object.fromEntries(
    CATEGORIES.map((category) => [category, records[category].length]),
  ) as Record<Category, number>;
}

async function applyPlan(
  { db }: DatabaseHandle,
  plan: ImportPlan,
  options: ApplyOptions,
): Promise<Partial<Record<Category, CategoryPlan>>> {
  if (plan.mode === 'replace' && options.confirmReplace !== true)
    throw new ImportRejected({ kind: 'replaceNotConfirmed' });
  if (plan.unresolved.length > 0)
    throw new ImportRejected({
      kind: 'unresolvedConflicts',
      conflicts: plan.unresolved,
    });
  const snapshot = await loadSnapshot(db);
  const fresh = computePlan(plan.file, snapshot, plan);
  if (planFingerprint(fresh.plan) !== planFingerprint(plan))
    throw new ImportRejected({ kind: 'stalePlan' });
  await applyWrites(db, fresh.plan, fresh.writes, snapshot);
  return fresh.plan.counts;
}

export function createBackupService(handle: DatabaseHandle) {
  const { serial, transaction } = handle.transactor;
  return {
    summary: () => serial(() => summary(handle)),
    export: (categories: readonly Category[] = CATEGORIES) =>
      serial(() => exportBackup(handle, categories)),
    plan: (input: string | Uint8Array, options: ImportOptions = {}) =>
      serial(() =>
        captured(
          async () =>
            computePlan(
              parseBackup(input),
              await loadSnapshot(handle.db),
              options,
            ).plan,
        ),
      ),
    apply: (plan: ImportPlan, options: ApplyOptions = {}) =>
      captured(() => transaction(() => applyPlan(handle, plan, options))),
  };
}

export type BackupService = ReturnType<typeof createBackupService>;
