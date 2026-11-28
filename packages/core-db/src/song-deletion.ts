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

// Held before the row goes, so a kill before its files are deleted leaves a record.
export async function deleteSong(
  db: Database,
  id: number,
): Promise<DeletedSong | undefined> {
  const [row] = await db.select().from(songs).where(eq(songs.id, id));
  if (row === undefined) return undefined;
  const { uuid, filePath, waveformPath } = row;
  await holdSongFiles(db, { songId: id, uuid, filePath, waveformPath });
  const queued = await locateQueueEntry(db, { kind: 'song', id });
  const presets = await db
    .update(songPresets)
    .set({ librarySongId: null })
    .where(eq(songPresets.librarySongId, id))
    .returning({ id: songPresets.id });
  await db.delete(songs).where(eq(songs.id, id));
  return { row, presetIds: presets.map((preset) => preset.id), queued };
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
