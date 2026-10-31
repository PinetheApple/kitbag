import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { connectDatabase } from './client';
import { fakeOpSqlite } from './op-sqlite-fake.test-helper';
import { songPresets, songs, stems, stemSets } from './schema';
import { createSetlistRepository } from './setlist-repository';
import { packFloat32, packInt32 } from './packing';
import { createSongLibraryRepository } from './song-library-repository';
import { createSongPresetRepository } from './song-preset-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return {
    handle,
    library: createSongLibraryRepository(handle),
    sets: createSetlistRepository(handle),
    presets: createSongPresetRepository(handle),
  };
}

const song = (title: string) => ({
  uuid: `uuid-${title}`,
  title,
  artist: 'Artist',
  filePath: `songs/uuid-${title}/${title}.mp3`,
  durationSec: 250.5,
  format: 'mp3',
});

const okResult = (title: string, waveform = `${title}.kwav`) => ({
  filePath: `songs/uuid-${title}/${title}.mp3`,
  ok: true as const,
  bpm: 158,
  beats: [0.5, 1.25],
  downbeats: [0, 300],
  waveformPath: `songs/uuid-${title}/${waveform}`,
});

const failure = (title: string) => ({
  filePath: `songs/uuid-${title}/${title}.mp3`,
  ok: false as const,
  error: 'No song at that path',
});

async function addStemSet(
  handle: ReturnType<typeof setup>['handle'],
  name: string,
  durations: readonly number[],
) {
  const [set] = await handle.db
    .insert(stemSets)
    .values({ name, createdAt: new Date(0), uuid: crypto.randomUUID() })
    .returning();
  if (set === undefined) throw new Error('stem set insert');
  for (const [i, duration] of durations.entries())
    await handle.db.insert(stems).values({
      stemSetId: set.id,
      role: 'drums',
      filePath: `stems/${name}/${String(i)}.flac`,
      duration,
      format: 'flac',
      channelCount: 2,
      sampleRate: 48000,
      gain: 1,
      muted: false,
      soloed: false,
      sortOrder: i,
    });
  return set.id;
}

describe('song library repository', () => {
  it('lists songs and stem songs in one list, newest first', async () => {
    const { handle, library } = setup();
    const stemId = await addStemSet(handle, 'Redbone', [320, 326.5, 300]);
    await addStemSet(handle, 'Empty', []);
    const first = await library.insertSong(song('Everlong'));
    const second = await library.insertSong(song('Take Five'));
    const rows = await library.list();
    expect(rows.map((row) => [row.kind, row.title])).toEqual([
      ['song', 'Take Five'],
      ['song', 'Everlong'],
      ['stems', 'Empty'],
      ['stems', 'Redbone'],
    ]);
    const byKey = (kind: string, id: number) =>
      rows.find((row) => row.kind === kind && row.id === id);
    expect(byKey('stems', stemId)).toMatchObject({
      kind: 'stems',
      stemCount: 3,
      durationSec: 326.5,
    });
    expect(rows.find((row) => row.title === 'Empty')).toMatchObject({
      stemCount: 0,
      durationSec: 0,
    });
    expect(byKey('song', first)).toMatchObject({
      kind: 'song',
      durationSec: 250.5,
      bpm: null,
      hasGrid: false,
      analysisStatus: 'analyzing',
      analysisError: null,
      inSetlist: false,
    });
    expect(second).toBeGreaterThan(first);
  });

  it('claims pending and unfinished songs for analysis, leaving finished ones', async () => {
    const { handle, library } = setup();
    const done = await library.insertSong(song('Done'));
    await library.insertSong(song('Running'));
    const restored = await library.insertSong(song('Restored'));
    await library.applyAnalysis(okResult('Done'));
    await handle.db
      .update(songs)
      .set({ analysisStatus: 'pending' })
      .where(eq(songs.id, restored));
    expect(
      (await library.claimUnfinishedAnalyses()).map((t) => t.filePath),
    ).toEqual([
      'songs/uuid-Running/Running.mp3',
      'songs/uuid-Restored/Restored.mp3',
    ]);
    expect(
      (await library.list()).map((row) =>
        row.kind === 'song' ? [row.id === done, row.analysisStatus] : [],
      ),
    ).toEqual([
      [false, 'analyzing'],
      [false, 'analyzing'],
      [true, 'done'],
    ]);
  });

  it('marks a re-analysis as running and hands back the song files', async () => {
    const { library } = setup();
    const id = await library.insertSong(song('A'));
    await library.applyAnalysis(failure('A'));
    expect(await library.beginAnalysis(id)).toEqual({
      uuid: 'uuid-A',
      filePath: 'songs/uuid-A/A.mp3',
      waveformPath: null,
    });
    expect(await library.list()).toEqual([
      expect.objectContaining({
        analysisStatus: 'analyzing',
        analysisError: null,
      }),
    ]);
    expect(await library.beginAnalysis(99)).toBeUndefined();
  });

  it('stores the grid as little-endian float32 and downbeats as int32', async () => {
    const { handle, library } = setup();
    const id = await library.insertSong(song('A'));
    expect(await library.applyAnalysis(okResult('A'))).toEqual({
      found: true,
      unusedWaveform: null,
    });
    const [row] = await handle.db.select().from(songs).where(eq(songs.id, id));
    expect(row?.beatGrid).toEqual(
      Uint8Array.from([0, 0, 0, 0x3f, 0, 0, 0xa0, 0x3f]),
    );
    expect(row?.downbeatIndices).toEqual(
      Uint8Array.from([0, 0, 0, 0, 0x2c, 1, 0, 0]),
    );
    expect(row).toMatchObject({
      bpm: 158,
      waveformPath: 'songs/uuid-A/A.kwav',
      analysisStatus: 'done',
      analysisError: null,
    });
  });

  it('applies the same result twice to the same row', async () => {
    const { library } = setup();
    await library.insertSong(song('A'));
    await library.applyAnalysis(okResult('A'));
    const once = await library.list();
    expect(await library.applyAnalysis(okResult('A'))).toEqual({
      found: true,
      unusedWaveform: null,
    });
    expect(await library.list()).toEqual(once);
  });

  it('finishes an analysis that found no beats without a grid', async () => {
    const { handle, library } = setup();
    const id = await library.insertSong(song('Drone'));
    await library.applyAnalysis({
      filePath: 'songs/uuid-Drone/Drone.mp3',
      ok: true,
      bpm: null,
      beats: [],
      downbeats: [],
      waveformPath: null,
    });
    const [row] = await handle.db.select().from(songs).where(eq(songs.id, id));
    expect(row).toMatchObject({
      beatGrid: null,
      downbeatIndices: null,
      bpm: null,
      waveformPath: null,
      analysisStatus: 'done',
    });
  });

  it('keeps the previous analysis and records the error when re-analysis fails', async () => {
    const { library } = setup();
    await library.insertSong(song('A'));
    await library.applyAnalysis(okResult('A'));
    expect(await library.applyAnalysis(failure('A'))).toEqual({
      found: true,
      unusedWaveform: null,
    });
    expect(await library.list()).toEqual([
      expect.objectContaining({
        bpm: 158,
        hasGrid: true,
        analysisStatus: 'failed',
        analysisError: 'No song at that path',
      }),
    ]);
  });

  it('reports a waveform the new analysis replaced', async () => {
    const { library } = setup();
    await library.insertSong(song('A'));
    await library.applyAnalysis(okResult('A'));
    expect(await library.applyAnalysis(okResult('A', 'A-2.kwav'))).toEqual({
      found: true,
      unusedWaveform: 'songs/uuid-A/A.kwav',
    });
  });

  it('hands back the waveform of a song deleted before its result landed', async () => {
    const { library } = setup();
    expect(await library.applyAnalysis(okResult('Gone'))).toEqual({
      found: false,
      unusedWaveform: 'songs/uuid-Gone/Gone.kwav',
    });
    expect(await library.applyAnalysis(failure('Gone'))).toEqual({
      found: false,
      unusedWaveform: null,
    });
  });

  it('never hands back a waveform another row still points at', async () => {
    const { library } = setup();
    await library.insertSong(song('A'));
    await library.applyAnalysis(okResult('A'));
    expect(
      await library.applyAnalysis({
        ...okResult('Gone'),
        waveformPath: 'songs/uuid-A/A.kwav',
      }),
    ).toEqual({ found: false, unusedWaveform: null });
  });

  it('marks a song in a setlist through a preset that points at it', async () => {
    const { handle, library, sets, presets } = setup();
    const inSet = await library.insertSong(song('In set'));
    const presetOnly = await library.insertSong(song('Preset only'));
    const make = (name: string, librarySongId: number) =>
      presets.create({
        name,
        bpm: 120,
        beatsPerBar: 4,
        subdivision: 1,
        accents: new Uint8Array([2, 1, 1, 1]),
        polyEnabled: false,
        polyBeats: 0,
        sound: 0,
        librarySongId,
      });
    const listed = await make('Listed', inSet);
    await make('Loose', presetOnly);
    const setlist = await sets.create('Friday');
    await sets.add(setlist.id, listed.id);
    const flags = Object.fromEntries(
      (await library.list()).map((row) => [
        row.title,
        row.kind === 'song' && row.inSetlist,
      ]),
    );
    expect(flags).toEqual({ 'In set': true, 'Preset only': false });
    await library.deleteSong(inSet);
    const [kept] = await handle.db
      .select()
      .from(songPresets)
      .where(eq(songPresets.id, listed.id));
    expect(kept?.librarySongId).toBeNull();
  });

  it('deletes a song and returns the files it owned', async () => {
    const { library } = setup();
    const bare = await library.insertSong(song('Bare'));
    const analyzed = await library.insertSong(song('Analyzed'));
    await library.applyAnalysis(okResult('Analyzed', 'Analyzed.kwav'));
    expect(await library.deleteSong(bare)).toEqual({
      uuid: 'uuid-Bare',
      filePath: 'songs/uuid-Bare/Bare.mp3',
      waveformPath: null,
    });
    expect(await library.deleteSong(analyzed)).toEqual({
      uuid: 'uuid-Analyzed',
      filePath: 'songs/uuid-Analyzed/Analyzed.mp3',
      waveformPath: 'songs/uuid-Analyzed/Analyzed.kwav',
    });
    expect(await library.deleteSong(analyzed)).toBeUndefined();
    expect(await library.list()).toEqual([]);
  });

  it('deletes a stem song with its stems and returns their files', async () => {
    const { handle, library } = setup();
    const id = await addStemSet(handle, 'Redbone', [1, 2]);
    expect(await library.deleteStemSet(id)).toEqual({
      folder: null,
      files: ['stems/Redbone/0.flac', 'stems/Redbone/1.flac'],
    });
    expect(await handle.db.select().from(stems)).toEqual([]);
    expect(await library.list()).toEqual([]);
  });

  it('lists each song with its stored file path', async () => {
    const { library } = setup();
    const first = await library.insertSong(song('Everlong'));
    const second = await library.insertSong(song('Take Five'));
    expect(await library.listSongFiles()).toEqual([
      { id: first, filePath: 'songs/uuid-Everlong/Everlong.mp3' },
      { id: second, filePath: 'songs/uuid-Take Five/Take Five.mp3' },
    ]);
  });

  it('lists each stem file with its stem set', async () => {
    const { handle, library } = setup();
    const redbone = await addStemSet(handle, 'Redbone', [320, 326.5]);
    await addStemSet(handle, 'Empty', []);
    expect(await library.listStemFiles()).toEqual([
      { setId: redbone, filePath: 'stems/Redbone/0.flac' },
      { setId: redbone, filePath: 'stems/Redbone/1.flac' },
    ]);
  });

  it('packs values without a Buffer', () => {
    expect(packFloat32([1])).toEqual(Uint8Array.from([0, 0, 0x80, 0x3f]));
    expect(packInt32([-1])).toEqual(Uint8Array.from([0xff, 0xff, 0xff, 0xff]));
  });
});

describe('song library over the op-sqlite 17 connection', () => {
  it('imports, analyzes, lists and deletes', async () => {
    const database = connectDatabase(fakeOpSqlite().connection);
    const id = await database.songLibrary.insertSong(song('Everlong'));
    expect(await database.songLibrary.claimUnfinishedAnalyses()).toEqual([
      expect.objectContaining({ uuid: 'uuid-Everlong' }),
    ]);
    await database.songLibrary.applyAnalysis(okResult('Everlong'));
    expect(await database.songLibrary.list()).toEqual([
      expect.objectContaining({
        kind: 'song',
        title: 'Everlong',
        bpm: 158,
        hasGrid: true,
        inSetlist: false,
        createdAt: expect.any(Date) as Date,
      }),
    ]);
    expect(await database.songLibrary.deleteSong(id)).toMatchObject({
      waveformPath: 'songs/uuid-Everlong/Everlong.kwav',
    });
    await database.close();
  });
});
