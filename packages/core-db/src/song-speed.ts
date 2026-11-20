import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import { songs } from './schema';

export function isSongSpeed(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export async function saveSongSpeed(
  db: Database,
  id: number,
  speed: number,
): Promise<void> {
  if (!isSongSpeed(speed))
    throw new RangeError(`Song speed ${String(speed)} is not above 0`);
  await db.update(songs).set({ speed }).where(eq(songs.id, id));
}
