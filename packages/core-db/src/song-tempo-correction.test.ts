import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { songs } from './schema';
import { createSongLibraryRepository } from './song-library-repository';
import { openTestDatabase } from './sqlite.test-helper';
import { TEMPO_CORRECTION, type TempoCorrection } from './tempo-correction';

const ANALYSIS_VERSION = 2;
const TITLE = 'Shuffle';
const FILE = `songs/uuid-s/${TITLE}.mp3`;

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

async function analysedSong() {
  const handle = openTestDatabase();
  open.push(handle);
  const library = createSongLibraryRepository(handle);
  const id = await library.insertSong({
    uuid: 'uuid-s',
    title: TITLE,
    artist: '',
    filePath: FILE,
    durationSec: 200,
    format: 'mp3',
  });
  await library.applyAnalysis(okResult());
  return { handle, library, id };
}

const okResult = () => ({
  filePath: FILE,
  ok: true as const,
  bpm: 104,
  beats: [0.5, 1, 1.5, 2],
  downbeats: [0],
  waveformPath: null,
  durationSec: null,
  analysisVersion: ANALYSIS_VERSION,
});

const failure = () => ({ filePath: FILE, ok: false as const, error: 'x' });

async function storedColumn(
  handle: ReturnType<typeof openTestDatabase>,
  id: number,
) {
  const [row] = await handle.db
    .select({ value: songs.tempoCorrection })
    .from(songs)
    .where(eq(songs.id, id));
  return row?.value;
}

describe('song tempo correction', () => {
  it('reads a song never corrected as ×1', async () => {
    const { handle, library, id } = await analysedSong();
    expect(await storedColumn(handle, id)).toBeNull();
    expect((await library.readSong(id))?.tempoCorrection).toBe(
      TEMPO_CORRECTION.none,
    );
  });

  it.each(Object.values(TEMPO_CORRECTION))('saves and reads %s', async (c) => {
    const { library, id } = await analysedSong();
    await library.saveSongTempoCorrection(id, c);
    expect((await library.readSong(id))?.tempoCorrection).toBe(c);
  });

  it('stores ×1 as NULL', async () => {
    const { handle, library, id } = await analysedSong();
    await library.saveSongTempoCorrection(id, TEMPO_CORRECTION.double);
    await library.saveSongTempoCorrection(id, TEMPO_CORRECTION.none);
    expect(await storedColumn(handle, id)).toBeNull();
  });

  it('refuses an unknown factor and stores nothing', async () => {
    const { handle, library, id } = await analysedSong();
    await expect(
      library.saveSongTempoCorrection(id, 'triple' as TempoCorrection),
    ).rejects.toThrow(RangeError);
    expect(await storedColumn(handle, id)).toBeNull();
  });

  it('reads a stored value it does not know as ×1', async () => {
    const { handle, library, id } = await analysedSong();
    await handle.db
      .update(songs)
      .set({ tempoCorrection: 'triple' as TempoCorrection })
      .where(eq(songs.id, id));
    expect((await library.readSong(id))?.tempoCorrection).toBe(
      TEMPO_CORRECTION.none,
    );
  });

  it.each([
    ['a new grid', okResult],
    ['a failed re-analysis', failure],
  ])('survives %s', async (_name, result) => {
    const { library, id } = await analysedSong();
    await library.saveSongTempoCorrection(id, TEMPO_CORRECTION.threeHalves);
    await library.beginAnalysis(id);
    await library.applyAnalysis(result());
    expect((await library.readSong(id))?.tempoCorrection).toBe(
      TEMPO_CORRECTION.threeHalves,
    );
  });
});
