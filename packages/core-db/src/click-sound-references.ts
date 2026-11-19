import { eq } from 'drizzle-orm';

import { SOUND_COUNT, SOUND_ID_COUNT, TICK_SOUND } from './preset-rules';
import type { Database } from './repository';
import { songPresets } from './schema';

const customSlotOf = (soundId: number) =>
  soundId >= SOUND_COUNT && soundId < SOUND_ID_COUNT
    ? soundId - SOUND_COUNT
    : null;

export type SlotStale = (presetUuid: string, slot: number) => boolean;

const sameBytes = (a: Uint8Array | null, b: Uint8Array | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.length === b.length &&
    a.every((byte, i) => byte === b[i]));

export async function resetStaleSounds(
  db: Database,
  stale: SlotStale,
): Promise<number> {
  const rows = await db
    .select({
      id: songPresets.id,
      uuid: songPresets.uuid,
      sound: songPresets.sound,
      perAccentSounds: songPresets.perAccentSounds,
    })
    .from(songPresets);
  let reset = 0;
  for (const row of rows) {
    const kept = (soundId: number) => {
      const slot = customSlotOf(soundId);
      return slot !== null && stale(row.uuid, slot) ? TICK_SOUND : soundId;
    };
    const sound = kept(row.sound);
    const perAccentSounds =
      row.perAccentSounds && Uint8Array.from(row.perAccentSounds, kept);
    if (sound === row.sound && sameBytes(perAccentSounds, row.perAccentSounds))
      continue;
    await db
      .update(songPresets)
      .set({ sound, perAccentSounds })
      .where(eq(songPresets.id, row.id));
    reset += 1;
  }
  return reset;
}
