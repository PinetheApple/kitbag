import { found, type Database } from './repository';
import { stemSets } from './schema';

export async function insertStemSet(db: Database, name: string) {
  const { id } = found(
    await db
      .insert(stemSets)
      .values({ name, createdAt: new Date(0), uuid: `uuid-${name}` })
      .returning({ id: stemSets.id }),
    'Stem set insert',
  );
  return id;
}
