import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import { playQueue, setlistItems } from './schema';

const ENTRY_TABLES = [setlistItems, playQueue] as const;

export async function repointStemSetEntries(
  db: Database,
  from: number,
  to: number,
): Promise<void> {
  for (const table of ENTRY_TABLES)
    await db
      .update(table)
      .set({ stemSetId: to })
      .where(eq(table.stemSetId, from));
}

export async function deleteStemSetEntries(
  db: Database,
  stemSetId: number,
): Promise<void> {
  for (const table of ENTRY_TABLES)
    await db.delete(table).where(eq(table.stemSetId, stemSetId));
}
