import { eq } from 'drizzle-orm';

import { SOUND_COUNT, SOUND_ID_COUNT, TICK_SOUND } from './preset-rules';
import type { Database } from './repository';
import { songPresets } from './schema';

export interface PresetSounds {
  readonly id: number;
  readonly sound: number;
  readonly perAccentSounds: Uint8Array | null;
}

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
): Promise<PresetSounds[]> {
  const rows = await db
    .select({
      id: songPresets.id,
      uuid: songPresets.uuid,
      sound: songPresets.sound,
      perAccentSounds: songPresets.perAccentSounds,
    })
    .from(songPresets);
  const reset: PresetSounds[] = [];
  for (const row of rows) {
    const soundAfterReset = (soundId: number) => {
      const slot = customSlotOf(soundId);
      return slot !== null && stale(row.uuid, slot) ? TICK_SOUND : soundId;
    };
    const sound = soundAfterReset(row.sound);
    const perAccentSounds =
      row.perAccentSounds &&
      Uint8Array.from(row.perAccentSounds, soundAfterReset);
    if (sound === row.sound && sameBytes(perAccentSounds, row.perAccentSounds))
      continue;
    await db
      .update(songPresets)
      .set({ sound, perAccentSounds })
      .where(eq(songPresets.id, row.id));
    reset.push({
      id: row.id,
      sound: row.sound,
      perAccentSounds: row.perAccentSounds,
    });
  }
  return reset;
}

export async function restoreSlotSounds(
  db: Database,
  slot: number,
  resets: readonly PresetSounds[],
): Promise<void> {
  const soundId = SOUND_COUNT + slot;
  const back = (current: number, previous: number | undefined) =>
    current === TICK_SOUND && previous === soundId ? soundId : current;
  for (const previous of resets) {
    const [row] = await db
      .select({
        sound: songPresets.sound,
        perAccentSounds: songPresets.perAccentSounds,
      })
      .from(songPresets)
      .where(eq(songPresets.id, previous.id));
    if (row === undefined) continue;
    const sound = back(row.sound, previous.sound);
    const perAccentSounds =
      row.perAccentSounds &&
      Uint8Array.from(row.perAccentSounds, (current, i) =>
        back(current, previous.perAccentSounds?.[i]),
      );
    await db
      .update(songPresets)
      .set({ sound, perAccentSounds })
      .where(eq(songPresets.id, previous.id));
  }
}
