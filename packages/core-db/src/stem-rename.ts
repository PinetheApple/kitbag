import { and, eq, isNotNull } from 'drizzle-orm';

import type { Database } from './repository';
import { stems, stemSets } from './schema';

export interface UserNames {
  readonly title: string | null;
  readonly stems: readonly (readonly [role: string, name: string])[];
}

export async function renameStemSet(
  db: Database,
  id: number,
  title: string,
): Promise<void> {
  await db
    .update(stemSets)
    .set({ name: title, songTitle: title, renamed: true })
    .where(eq(stemSets.id, id));
}

export async function renameStem(
  db: Database,
  id: number,
  name: string,
): Promise<void> {
  await db.update(stems).set({ name }).where(eq(stems.id, id));
}

export async function readUserNames(
  db: Database,
  setId: number,
): Promise<UserNames> {
  const [set] = await db
    .select({ name: stemSets.name, renamed: stemSets.renamed })
    .from(stemSets)
    .where(eq(stemSets.id, setId));
  const named = await db
    .select({ role: stems.role, name: stems.name })
    .from(stems)
    .where(and(eq(stems.stemSetId, setId), isNotNull(stems.name)));
  return {
    title: set?.renamed === true ? set.name : null,
    stems: named.flatMap(({ role, name }) =>
      name === null ? [] : [[role, name] as const],
    ),
  };
}

export async function applyUserNames(
  db: Database,
  setId: number,
  names: UserNames,
): Promise<void> {
  if (names.title !== null) await renameStemSet(db, setId, names.title);
  for (const [role, name] of names.stems)
    await db
      .update(stems)
      .set({ name })
      .where(and(eq(stems.stemSetId, setId), eq(stems.role, role)));
}
