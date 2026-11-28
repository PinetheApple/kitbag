import { eq } from 'drizzle-orm';

import type { ImportCategory } from './backup-format';
import { parseBackup } from './backup-parse';
import type { BackupRules } from './backup-rules';
import type { Database } from './repository';
import { preferences } from './schema';

const BEFORE_REPLACE_KEY = 'backup_before_replace';
const BEFORE_REPLACE_TAKEN_AT_KEY = 'backup_before_replace_taken_at';

export interface KeptBeforeReplace {
  categories: ImportCategory[];
  contents: string;
}

async function put(db: Database, key: string, value: string) {
  await db
    .insert(preferences)
    .values({ key, value })
    .onConflictDoUpdate({ target: preferences.key, set: { value } });
}

async function read(db: Database, key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: preferences.value })
    .from(preferences)
    .where(eq(preferences.key, key));
  return row?.value ?? null;
}

export async function keepBeforeReplace(
  db: Database,
  kept: KeptBeforeReplace,
  takenAt?: string,
): Promise<void> {
  await put(db, BEFORE_REPLACE_KEY, JSON.stringify(kept));
  if (takenAt === undefined)
    await db
      .delete(preferences)
      .where(eq(preferences.key, BEFORE_REPLACE_TAKEN_AT_KEY));
  else await put(db, BEFORE_REPLACE_TAKEN_AT_KEY, takenAt);
}

export async function readBeforeReplace(
  db: Database,
): Promise<KeptBeforeReplace | null> {
  const value = await read(db, BEFORE_REPLACE_KEY);
  return value === null ? null : (JSON.parse(value) as KeptBeforeReplace);
}

export async function readBeforeReplaceTakenAt(
  db: Database,
  rules: BackupRules,
): Promise<string | null> {
  const takenAt = await read(db, BEFORE_REPLACE_TAKEN_AT_KEY);
  if (takenAt !== null) return takenAt;
  const kept = await readBeforeReplace(db);
  return kept === null ? null : parseBackup(kept.contents, rules).exportedAt;
}
