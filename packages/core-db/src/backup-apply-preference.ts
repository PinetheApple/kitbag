import { sql } from 'drizzle-orm';

import type { PreferenceRecord } from './backup-format';
import { found, type Database } from './repository';
import { preferences } from './schema';

export async function upsertPreference(
  db: Database,
  record: PreferenceRecord,
): Promise<number> {
  const { key, value } = record;
  const rows = await db
    .insert(preferences)
    .values({ key, value })
    .onConflictDoUpdate({ target: preferences.key, set: { value } })
    .returning({ id: sql<number>`rowid` });
  return found(rows, 'Preference upsert').id;
}
