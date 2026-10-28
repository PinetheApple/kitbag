import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { connectDatabase } from './client';
import { fakeOpSqlite } from './op-sqlite-fake.test-helper';
import { stems, stemSets } from './schema';
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
  return { handle, library: createSongLibraryRepository(handle) };
}

const RATE = 44100;
const FRAMES = 16643340;
const NAMES = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'];

const FULL: NewStemBundle = {
  uuid: 'set-uuid-1',
  jobId: '0297074f4836',
  title: 'Song title',
  folder: 'stems/0297074f4836',
  sampleRate: RATE,
  channels: 2,
  stems: NAMES.map((name, i) => ({
    name,
    filePath: `stems/0297074f4836/${name}.flac`,
    waveformPath: `stems/0297074f4836/${name}.kwav`,
    frames: FRAMES - i,
    volume: name === 'bass' ? 1.5 : 1,
    muted: name === 'guitar',
    soloed: false,
    pitch: name === 'drums' ? 0 : -2,
  })),
  bpm: 92.5,
  key: 'A',
  scale: 'minor',
  keyConfidence: 81,
  loudnessLufs: -9.4,
  tempoStability: 96,
  sections: [
    {
      name: 'Intro',
      kind: 'intro',
      color: '#5b8def',
      startSec: 0,
      endSec: 12.25,
    },
    {
      name: 'Verse 1',
      kind: 'verse',
      color: '#e0a03a',
      startSec: 12.25,
      endSec: 48.5,
    },
    { name: 'Hook', kind: '', color: '', startSec: 48.5, endSec: 70 },
  ],
  beats: [0.5, 1.149, 1.798, 2.447, 3.096, 3.745],
  bars: [
    { beat: 0, beatsPerBar: 4 },
    { beat: 4, beatsPerBar: 3 },
  ],
  lyrics: {
    synced: '[00:12.25]First line\n[00:15.80]Second line',
    plain: 'First line\nSecond line',
    offsetSec: -0.35,
    instrumental: false,
  },
};

const BARE: NewStemBundle = {
  ...FULL,
  uuid: 'set-uuid-2',
  jobId: 'bare-job',
  title: '',
  folder: 'stems/bare-job',
  stems: [
    {
      name: 'other',
      filePath: 'stems/bare-job/other.flac',
      waveformPath: null,
      frames: RATE,
      volume: 1,
      muted: false,
      soloed: false,
      pitch: 0,
    },
  ],
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

describe('StemDeck bundles in the song library', () => {
  it('reads back every field of an imported 6-stem 44.1 kHz bundle', async () => {
    const { library } = setup();
    const before = Date.now();
    const id = await library.insertStemBundle(FULL);
    const stored = await library.readStemSet(id);
    expect(stored?.createdAt.getTime()).toBeGreaterThanOrEqual(
      Math.floor(before / 1000) * 1000,
    );
    expect(stored).toEqual({
      id,
      uuid: 'set-uuid-1',
      title: 'Song title',
      source: 'stemdeck',
      jobId: '0297074f4836',
      folder: 'stems/0297074f4836',
      sampleRate: RATE,
      createdAt: expect.any(Date) as Date,
      speed: 1,
      bpm: 92.5,
      key: 'A',
      scale: 'minor',
      keyConfidence: 81,
      loudnessLufs: -9.4,
      tempoStability: 96,
      beats: FULL.beats.map(Math.fround),
      bars: FULL.bars,
      sections: FULL.sections,
      lyrics: FULL.lyrics,
      lyricsRetimed: null,
      stems: FULL.stems.map((stem) => ({
        ...stem,
        id: expect.any(Number) as number,
        durationSec: stem.frames / RATE,
        format: 'flac',
        channels: 2,
        sampleRate: RATE,
      })),
    });
    expect(stored?.stems.filter((stem) => stem.muted)).toEqual([
      expect.objectContaining({ name: 'guitar' }),
    ]);
  });

  it('lists it as a stem song with its stem count and longest stem', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle(FULL);
    expect(await library.list()).toEqual([
      {
        kind: 'stems',
        id,
        title: 'Song title',
        stemCount: 6,
        durationSec: FRAMES / RATE,
        createdAt: expect.any(Date) as Date,
      },
    ]);
  });

  it('stores a bundle with every optional member missing', async () => {
    const { handle, library } = setup();
    const id = await library.insertStemBundle(BARE);
    const [row] = await handle.db.select().from(stemSets);
    expect(row).toMatchObject({
      beatGrid: null,
      barMarks: null,
      sections: null,
      lyricsSynced: null,
      lyricsPlain: null,
      lyricsOffset: null,
      lyricsInstrumental: null,
    });
    expect(await library.readStemSet(id)).toMatchObject({
      bpm: null,
      key: null,
      scale: null,
      keyConfidence: null,
      loudnessLufs: null,
      tempoStability: null,
      beats: [],
      bars: [],
      sections: [],
      lyrics: null,
      stems: [expect.objectContaining({ waveformPath: null, durationSec: 1 })],
    });
  });

  it('keeps an instrumental with no lyric text apart from no lyrics', async () => {
    const { library } = setup();
    const lyrics = {
      synced: null,
      plain: null,
      offsetSec: 0,
      instrumental: true,
    };
    const id = await library.insertStemBundle({ ...BARE, lyrics });
    expect((await library.readStemSet(id))?.lyrics).toEqual(lyrics);
  });

  it('finds a set by its StemDeck job and refuses a second insert of it', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle(FULL);
    expect(await library.findStemSetByJobId('0297074f4836')).toEqual({
      id,
      title: 'Song title',
    });
    expect(await library.findStemSetByJobId('other')).toBeUndefined();
    await expect(
      library.insertStemBundle({ ...FULL, uuid: 'again' }),
    ).rejects.toThrow();
    expect(await library.list()).toHaveLength(1);
  });

  it('replaces a set in one step and hands back the old folder', async () => {
    const { handle, library } = setup();
    const old = await library.insertStemBundle(FULL);
    const replacement: NewStemBundle = {
      ...FULL,
      uuid: 'set-uuid-3',
      title: 'Song title (new mix)',
      folder: 'stems/0297074f4836-2',
      stems: FULL.stems.slice(0, 2).map((stem) => ({
        ...stem,
        filePath: stem.filePath.replace('4836/', '4836-2/'),
        waveformPath: null,
      })),
    };
    const outcome = await library.replaceStemBundle(replacement);
    expect(outcome.replaced?.folder).toBe('stems/0297074f4836');
    expect(outcome.replaced?.files).toHaveLength(FULL.stems.length * 2);
    expect(await library.readStemSet(old)).toBeUndefined();
    expect(await library.readStemSet(outcome.id)).toMatchObject({
      title: 'Song title (new mix)',
      folder: 'stems/0297074f4836-2',
      stems: [
        expect.objectContaining({ name: 'vocals' }),
        expect.objectContaining({ name: 'drums' }),
      ],
    });
    expect(await handle.db.select().from(stems)).toHaveLength(2);
  });

  it('replaces nothing when the job is new', async () => {
    const { library } = setup();
    const outcome = await library.replaceStemBundle(FULL);
    expect(outcome.replaced).toBeNull();
    expect(await library.readStemSet(outcome.id)).toMatchObject({
      jobId: '0297074f4836',
    });
  });

  it('rolls a failed replace back, keeping the old set', async () => {
    const { library } = setup();
    const old = await library.insertStemBundle(FULL);
    const broken = {
      ...FULL,
      uuid: 'set-uuid-4',
      stems: [{ ...BARE.stems[0], filePath: null }],
    } as unknown as NewStemBundle;
    await expect(library.replaceStemBundle(broken)).rejects.toThrow();
    expect(await library.readStemSet(old)).toMatchObject({
      stems: expect.arrayContaining([
        expect.objectContaining({ name: 'piano' }),
      ]) as unknown,
    });
  });

  it('deletes a set and returns its folder and files', async () => {
    const { handle, library } = setup();
    const id = await library.insertStemBundle(BARE);
    expect(await library.deleteStemSet(id)).toEqual({
      folder: 'stems/bare-job',
      files: ['stems/bare-job/other.flac'],
    });
    expect(await handle.db.select().from(stems)).toEqual([]);
  });
});

describe('StemDeck bundles over the op-sqlite 17 connection', () => {
  it('inserts, replaces and reads back', async () => {
    const database = connectDatabase(fakeOpSqlite().connection);
    const first = await database.songLibrary.insertStemBundle(FULL);
    const { id, replaced } = await database.songLibrary.replaceStemBundle({
      ...FULL,
      uuid: 'set-uuid-5',
      folder: 'stems/0297074f4836-2',
    });
    expect(replaced?.folder).toBe('stems/0297074f4836');
    expect(id).not.toBe(first);
    expect(await database.songLibrary.readStemSet(id)).toMatchObject({
      beats: FULL.beats.map(Math.fround),
      bars: FULL.bars,
      sections: FULL.sections,
      lyrics: FULL.lyrics,
    });
    await database.close();
  });
});
