import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { createSongLibraryRepository } from './song-library-repository';
import type { NewStemBundle } from './stem-bundle-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return createSongLibraryRepository(handle);
}

const JOB = 'job-1';
const RATE = 48000;

function bundle(title: string, roles: readonly string[]): NewStemBundle {
  const folder = `stems/${JOB}-${title}`;
  return {
    uuid: `uuid-${title}`,
    jobId: JOB,
    title: `Charity Gayle - ${title}`,
    songTitle: title,
    artist: 'Charity Gayle',
    folder,
    sampleRate: RATE,
    channels: 2,
    stems: roles.map((role) => ({
      name: role,
      filePath: `${folder}/${role}.flac`,
      waveformPath: null,
      frames: RATE,
      volume: 1,
      muted: false,
      soloed: false,
      pitch: 0,
    })),
    bpm: null,
    key: null,
    scale: null,
    keyConfidence: null,
    loudnessLufs: null,
    tempoStability: null,
    sections: [],
    beats: [],
    bars: [],
    lyrics: null,
  };
}

describe('renaming in the song library', () => {
  it('renames a song without touching its file', async () => {
    const library = setup();
    await library.insertSong({
      uuid: 'u',
      title: 'track01',
      artist: 'Artist',
      filePath: 'songs/u/track01.mp3',
      durationSec: 200,
      format: 'mp3',
    });
    const [row] = await library.list();
    await library.renameSong(row?.id ?? 0, 'Echo');
    expect(await library.list()).toEqual([
      expect.objectContaining({ title: 'Echo', artist: 'Artist' }),
    ]);
    expect(await library.claimUnfinishedAnalyses()).toEqual([
      expect.objectContaining({ filePath: 'songs/u/track01.mp3' }),
    ]);
  });

  it('renames a stem song for the library and the player, keeping its files and job', async () => {
    const library = setup();
    const id = await library.insertStemBundle(bundle('Echo', ['other']));
    await library.renameStemSet(id, 'Echo (live)');
    expect(await library.list()).toEqual([
      expect.objectContaining({ kind: 'stems', title: 'Echo (live)' }),
    ]);
    expect(await library.readStemSet(id)).toMatchObject({
      title: 'Echo (live)',
      songTitle: 'Echo (live)',
      artist: 'Charity Gayle',
      jobId: JOB,
      folder: `stems/${JOB}-Echo`,
      stems: [
        expect.objectContaining({ filePath: `stems/${JOB}-Echo/other.flac` }),
      ],
    });
    expect(await library.findStemSetByJobId(JOB)).toEqual({
      id,
      title: 'Echo (live)',
    });
  });

  it('renames one stem and keeps its role', async () => {
    const library = setup();
    const id = await library.insertStemBundle(
      bundle('Echo', ['vocals', 'other']),
    );
    const other = (await library.readStemSet(id))?.stems[1];
    await library.renameStem(other?.id ?? 0, 'Keys');
    expect((await library.readStemSet(id))?.stems).toEqual([
      expect.objectContaining({ name: 'vocals', role: 'vocals' }),
      expect.objectContaining({ name: 'Keys', role: 'other' }),
    ]);
  });

  it('keeps the user’s song and stem names when the bundle is replaced', async () => {
    const library = setup();
    const id = await library.insertStemBundle(
      bundle('Echo', ['vocals', 'other']),
    );
    const other = (await library.readStemSet(id))?.stems[1];
    await library.renameStemSet(id, 'Echo (live)');
    await library.renameStem(other?.id ?? 0, 'Keys');
    const outcome = await library.replaceStemBundle(
      bundle('Echo v2', ['vocals', 'other', 'bass']),
    );
    expect(await library.readStemSet(outcome.id)).toMatchObject({
      title: 'Echo (live)',
      songTitle: 'Echo (live)',
      folder: `stems/${JOB}-Echo v2`,
      stems: [
        expect.objectContaining({ name: 'vocals', role: 'vocals' }),
        expect.objectContaining({ name: 'Keys', role: 'other' }),
        expect.objectContaining({ name: 'bass', role: 'bass' }),
      ],
    });
  });

  it('takes the new bundle’s title on replace when the user never renamed it', async () => {
    const library = setup();
    await library.insertStemBundle(bundle('Echo', ['other']));
    const outcome = await library.replaceStemBundle(
      bundle('Echo v2', ['other']),
    );
    expect(await library.readStemSet(outcome.id)).toMatchObject({
      title: 'Charity Gayle - Echo v2',
      songTitle: 'Echo v2',
    });
  });
});
