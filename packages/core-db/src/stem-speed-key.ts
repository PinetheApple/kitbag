import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import { stems, stemSets } from './schema';

export const STEM_SET_PITCH = { min: -6, max: 6, unshifted: 0 } as const;

export interface StemKey {
  readonly id: number;
  readonly pitch: number;
}

export interface StemSetSpeedKey {
  readonly speed: number;
  readonly pitch: number;
  readonly stems: readonly StemKey[];
}

export function isStemSetPitch(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= STEM_SET_PITCH.min &&
    value <= STEM_SET_PITCH.max
  );
}

export async function saveStemSetSpeedKey(
  db: Database,
  id: number,
  { speed, pitch, stems: keys }: StemSetSpeedKey,
): Promise<void> {
  await db.update(stemSets).set({ speed, pitch }).where(eq(stemSets.id, id));
  for (const key of keys)
    await db
      .update(stems)
      .set({ pitch: key.pitch })
      .where(eq(stems.id, key.id));
}
