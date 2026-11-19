import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import { songs } from './schema';
import {
  isTempoCorrection,
  storedTempoCorrection,
  type TempoCorrection,
} from './tempo-correction';

export async function saveTempoCorrection(
  db: Database,
  id: number,
  correction: TempoCorrection,
): Promise<void> {
  if (!isTempoCorrection(correction))
    throw new RangeError(`Unknown tempo correction ${String(correction)}`);
  await db
    .update(songs)
    .set({ tempoCorrection: storedTempoCorrection(correction) })
    .where(eq(songs.id, id));
}
