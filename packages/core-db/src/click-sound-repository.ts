import { asc, eq } from 'drizzle-orm';

import {
  resetStaleSounds,
  restoreSlotSounds,
  type PresetSounds,
} from './click-sound-references';
import { CUSTOM_SOUND_SLOTS } from './preset-rules';
import type { Database, DatabaseHandle } from './repository';
import { clickSounds } from './schema';

export type ClickSound = typeof clickSounds.$inferSelect;

export interface RemovedClickSound {
  removed: ClickSound | null;
  songsReset: number;
  resets: readonly PresetSounds[];
}

export interface RestorableClickSound {
  readonly sound: ClickSound;
  readonly resets: readonly PresetSounds[];
}

export const isClickSoundSlot = (slot: number) =>
  Number.isInteger(slot) && slot >= 0 && slot < CUSTOM_SOUND_SLOTS;

function checkSlot(slot: number) {
  if (!isClickSoundSlot(slot))
    throw new RangeError(
      `Click sound slot ${String(slot)}: expected 0–${String(CUSTOM_SOUND_SLOTS - 1)}`,
    );
}

function checkedName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') throw new RangeError('Click sound name: expected text');
  return trimmed;
}

export async function clickSoundIn(
  db: Database,
  slot: number,
): Promise<ClickSound | null> {
  const [row] = await db
    .select()
    .from(clickSounds)
    .where(eq(clickSounds.slot, slot));
  return row ?? null;
}

export async function putClickSound(db: Database, sound: ClickSound) {
  checkSlot(sound.slot);
  const row = { ...sound, name: checkedName(sound.name) };
  await db
    .insert(clickSounds)
    .values(row)
    .onConflictDoUpdate({ target: clickSounds.slot, set: row });
}

export function createClickSoundRepository({ db, transactor }: DatabaseHandle) {
  const { serial, transaction } = transactor;
  return {
    list: () =>
      serial(() =>
        db.select().from(clickSounds).orderBy(asc(clickSounds.slot)),
      ),
    get: (slot: number) => serial(() => clickSoundIn(db, slot)),
    put: (sound: ClickSound) =>
      transaction(async () => {
        const previous = await clickSoundIn(db, sound.slot);
        await putClickSound(db, sound);
        return previous;
      }),
    rename: (slot: number, name: string) =>
      serial(async () => {
        checkSlot(slot);
        await db
          .update(clickSounds)
          .set({ name: checkedName(name) })
          .where(eq(clickSounds.slot, slot));
      }),
    add: (sound: ClickSound) =>
      serial(async () => {
        checkSlot(sound.slot);
        const added = await db
          .insert(clickSounds)
          .values({ ...sound, name: checkedName(sound.name) })
          .onConflictDoNothing()
          .returning({ slot: clickSounds.slot });
        return added.length > 0;
      }),
    remove: (slot: number): Promise<RemovedClickSound> =>
      transaction(async () => {
        const removed = await clickSoundIn(db, slot);
        if (removed === null) return { removed, songsReset: 0, resets: [] };
        await db.delete(clickSounds).where(eq(clickSounds.slot, slot));
        const resets = await resetStaleSounds(db, (_, used) => used === slot);
        return { removed, songsReset: resets.length, resets };
      }),
    restore: ({ sound, resets }: RestorableClickSound) =>
      transaction(async () => {
        if ((await clickSoundIn(db, sound.slot)) !== null) return false;
        await putClickSound(db, sound);
        await restoreSlotSounds(db, sound.slot, resets);
        return true;
      }),
  };
}

export type ClickSoundRepository = ReturnType<
  typeof createClickSoundRepository
>;
