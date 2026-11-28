import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import { preferences } from './schema';
import type { SongFiles } from './song-library-repository';

const HELD_SONG_FILES_KEY = 'held_song_files';

export interface HeldSongFiles extends SongFiles {
  readonly songId: number;
}

const heldKey = eq(preferences.key, HELD_SONG_FILES_KEY);

export async function listHeldSongFiles(
  db: Database,
): Promise<HeldSongFiles[]> {
  const [row] = await db
    .select({ value: preferences.value })
    .from(preferences)
    .where(heldKey);
  return row === undefined ? [] : (JSON.parse(row.value) as HeldSongFiles[]);
}

async function saveHeld(db: Database, held: readonly HeldSongFiles[]) {
  if (held.length === 0) {
    await db.delete(preferences).where(heldKey);
    return;
  }
  const value = JSON.stringify(held);
  await db
    .insert(preferences)
    .values({ key: HELD_SONG_FILES_KEY, value })
    .onConflictDoUpdate({ target: preferences.key, set: { value } });
}

export async function holdSongFiles(db: Database, files: HeldSongFiles) {
  const others = (await listHeldSongFiles(db)).filter(
    ({ songId }) => songId !== files.songId,
  );
  await saveHeld(db, [...others, files]);
}

export async function releaseSongFiles(db: Database, songId: number) {
  const held = await listHeldSongFiles(db);
  const kept = held.filter((files) => files.songId !== songId);
  if (kept.length < held.length) await saveHeld(db, kept);
}
