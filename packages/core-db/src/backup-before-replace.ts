import { eq } from 'drizzle-orm';

import type { Category } from './backup-format';
import type { Database } from './repository';
import { preferences } from './schema';

const BEFORE_REPLACE_KEY = 'backup_before_replace';

export interface KeptBeforeReplace {
  categories: Category[];
  contents: string;
}

export async function keepBeforeReplace(
  db: Database,
  kept: KeptBeforeReplace,
): Promise<void> {
  const value = JSON.stringify(kept);
  await db
    .insert(preferences)
    .values({ key: BEFORE_REPLACE_KEY, value })
    .onConflictDoUpdate({ target: preferences.key, set: { value } });
}

export async function readBeforeReplace(
  db: Database,
): Promise<KeptBeforeReplace | null> {
  const [row] = await db
    .select({ value: preferences.value })
    .from(preferences)
    .where(eq(preferences.key, BEFORE_REPLACE_KEY));
  return row === undefined
    ? null
    : (JSON.parse(row.value) as KeptBeforeReplace);
}
