import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import {
  addStemDeckSong,
  bundle,
  JOB,
  stemSongDatabase,
} from './backup-stem-songs.test-helper';

const SPEED = 0.75;
const SONG_KEY = -2;
const BASS_KEY = 0;

async function keyedSong() {
  const database = stemSongDatabase();
  const id = await addStemDeckSong(database);
  const set = await database.library.readStemSet(id);
  const [vocals, drums] = set?.stems ?? [];
  if (vocals === undefined || drums === undefined) throw new Error('setup');
  await database.library.saveStemSetSpeedKey(id, {
    speed: SPEED,
    pitch: SONG_KEY,
    stems: [{ id: vocals.id, pitch: BASS_KEY }],
  });
  return { database, id };
}

describe('stem song speed and key', () => {
  it('stores the speed, the song key and each stem key it is given', async () => {
    const { database, id } = await keyedSong();
    const set = await database.library.readStemSet(id);
    expect(set).toMatchObject({ speed: SPEED, pitch: SONG_KEY });
    expect(set?.stems.map(({ pitch }) => pitch)).toEqual([BASS_KEY, 0]);
  });

  it('keeps the speed and song key when the song is imported again', async () => {
    const { database, id } = await keyedSong();
    const { id: replaced } = await database.library.replaceStemBundle(
      bundle(JOB),
      id,
    );
    expect(await database.library.readStemSet(replaced)).toMatchObject({
      speed: SPEED,
      pitch: SONG_KEY,
    });
  });
});
