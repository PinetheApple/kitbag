import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  openBackupDatabase,
  SESSION_START,
  unwrap,
} from './backup.test-helper';
import { packFloat32 } from './packing';
import { songs } from './schema';

const SONG_UUID = 'b0c8a7a4-1f7e-4c2a-9a55-6f1d2f0e8c31';
const CURRENT_VERSION = 2;
const BACKED_UP_BEATS = [0.5, 1, 1.5];
const REANALYSED_BEATS = [0.5, 1.5];

describe('restoring a song grid from a backup', () => {
  it('forgets the local analysis version, since the restored grid may be older', async () => {
    const database = openBackupDatabase();
    const { db } = database.handle;
    await db.insert(songs).values({
      title: 'Waltz',
      artist: '',
      filePath: 'songs/w/waltz.mp3',
      duration: 1,
      format: 'mp3',
      createdAt: SESSION_START,
      uuid: SONG_UUID,
      beatGrid: packFloat32(BACKED_UP_BEATS),
      analysisStatus: 'done',
    });
    const file = await database.backup.export();
    await db
      .update(songs)
      .set({
        beatGrid: packFloat32(REANALYSED_BEATS),
        analysisVersion: CURRENT_VERSION,
      })
      .where(eq(songs.uuid, SONG_UUID));
    const plan = unwrap(
      await database.backup.plan(file, {
        categories: ['librarySongs'],
        resolutions: { librarySongs: { [SONG_UUID]: 'theirs' } },
      }),
    );
    expect((await database.backup.apply(plan)).ok).toBe(true);
    const [row] = await db
      .select({ grid: songs.beatGrid, version: songs.analysisVersion })
      .from(songs)
      .where(eq(songs.uuid, SONG_UUID));
    expect(row?.grid).toEqual(packFloat32(BACKED_UP_BEATS));
    expect(row?.version).toBeNull();
  });
});
