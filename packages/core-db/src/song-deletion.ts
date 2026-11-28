import { and, eq, inArray, isNull } from 'drizzle-orm';

import { holdSongFiles, releaseSongFiles } from './held-song-files';
import {
  locateQueueEntry,
  restoreQueueEntry,
  type LocatedQueueEntry,
} from './play-queue-repository';
import type { Database } from './repository';
import { songPresets, songs } from './schema';

export interface DeletedSong {
  readonly row: typeof songs.$inferSelect;
  readonly presetIds: readonly number[];
  readonly queued: LocatedQueueEntry | null;
}

export async function deleteSong(
  db: Database,
  id: number,
): Promise<DeletedSong | undefined> {
  const [row] = await db.select().from(songs).where(eq(songs.id, id));
  if (row === undefined) return undefined;
  const queued = await locateQueueEntry(db, { kind: 'song', id });
  const presets = await db
    .update(songPresets)
    .set({ librarySongId: null })
    .where(eq(songPresets.librarySongId, id))
    .returning({ id: songPresets.id });
  await db.delete(songs).where(eq(songs.id, id));
  return { row, presetIds: presets.map((preset) => preset.id), queued };
}

// Held before the row goes, so a kill during Undo leaves a record of the files.
export async function deleteSongForUndo(
  db: Database,
  id: number,
): Promise<DeletedSong | undefined> {
  const [files] = await db
    .select({
      uuid: songs.uuid,
      filePath: songs.filePath,
      waveformPath: songs.waveformPath,
    })
    .from(songs)
    .where(eq(songs.id, id));
  if (files === undefined) return undefined;
  await holdSongFiles(db, { songId: id, ...files });
  return deleteSong(db, id);
}

export async function restoreSong(db: Database, deleted: DeletedSong) {
  const { row, presetIds, queued } = deleted;
  await db.insert(songs).values(row);
  if (presetIds.length > 0)
    await db
      .update(songPresets)
      .set({ librarySongId: row.id })
      .where(
        and(
          inArray(songPresets.id, [...presetIds]),
          isNull(songPresets.librarySongId),
        ),
      );
  if (queued !== null) await restoreQueueEntry(db, queued);
  await releaseSongFiles(db, row.id);
}
