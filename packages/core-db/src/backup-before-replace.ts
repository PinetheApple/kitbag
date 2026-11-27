import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import { preferences } from './schema';

const BEFORE_REPLACE_KEY = 'backup_before_replace';

export async function keepBeforeReplace(
  db: Database,
  contents: string,
): Promise<void> {
  await db
    .insert(preferences)
    .values({ key: BEFORE_REPLACE_KEY, value: contents })
    .onConflictDoUpdate({
      target: preferences.key,
      set: { value: contents },
    });
}

export async function readBeforeReplace(db: Database): Promise<string | null> {
  const [row] = await db
    .select({ value: preferences.value })
    .from(preferences)
    .where(eq(preferences.key, BEFORE_REPLACE_KEY));
  return row?.value ?? null;
}
