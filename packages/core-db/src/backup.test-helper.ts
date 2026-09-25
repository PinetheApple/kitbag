import { afterEach } from 'vitest';

import { createBackupService } from './backup';
import { practiceSessions, songs, tunings } from './schema';
import { createSetlistRepository } from './setlist-repository';
import { createSongPresetRepository } from './song-preset-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

export const SESSION_START = new Date('2026-07-14T20:00:00Z');

export function openBackupDatabase() {
  const handle = openTestDatabase();
  open.push(handle);
  return {
    handle,
    sets: createSetlistRepository(handle),
    presets: createSongPresetRepository(handle),
    backup: createBackupService(handle),
  };
}

export type BackupDatabase = ReturnType<typeof openBackupDatabase>;

export function presetValues(name: string, librarySongId: number | null) {
  return {
    name,
    bpm: 128.5,
    beatsPerBar: 4,
    subdivision: 3,
    denominator: 8,
    accents: Buffer.from('02010001', 'hex'),
    perAccentSounds: Buffer.from('0103', 'hex'),
    polyAccents: Buffer.from('020101', 'hex'),
    polyEnabled: true,
    polyBeats: 3,
    sound: 2,
    rampEnabled: true,
    rampStartBpm: 100,
    rampEndBpm: 140,
    rampBars: 8,
    barMuteEnabled: true,
    barMutePlayBars: 3,
    barMuteMuteBars: 1,
    countInBars: 2,
    notes: 'Fingerstyle — count 3',
    phaseNudge: -12.5,
    title: 'Song',
    artist: 'Artist',
    source: 'file',
    lengthSeconds: 210.25,
    librarySongId,
  };
}

async function seedLibrary({ handle }: BackupDatabase) {
  const [song] = await handle.db
    .insert(songs)
    .values({
      title: 'Reference',
      artist: 'Someone',
      filePath: 'music/ref.flac',
      duration: 210.5,
      format: 'flac',
      createdAt: new Date('2026-01-02T03:04:05Z'),
      beatGrid: Buffer.from('0000003f0000a03f', 'hex'),
      downbeatIndices: Buffer.from([0]),
      bpm: 128,
      waveformPath: null,
      uuid: crypto.randomUUID(),
    })
    .returning();
  if (!song) throw new Error('seed song missing');
  return song;
}

export async function seed(database: BackupDatabase) {
  const { handle, sets, presets } = database;
  const song = await seedLibrary(database);
  const opener = await presets.create(presetValues('Opener', song.id));
  const closer = await presets.create(presetValues('Closer', null));
  const friday = await sets.create('Friday');
  const acoustic = await sets.create('Acoustic');
  await sets.add(friday.id, closer.id);
  await sets.add(friday.id, opener.id);
  await sets.add(acoustic.id, opener.id);
  await sets.selectActive(friday.id);
  await handle.db.insert(tunings).values({
    name: 'Drop D',
    notes: Buffer.from('262d32373b40', 'hex'),
    uuid: crypto.randomUUID(),
  });
  await handle.db.insert(practiceSessions).values({
    startTime: SESSION_START,
    durationSeconds: 1800,
    avgBpm: 120,
    setlistId: friday.id,
    songsPlayed: JSON.stringify([opener.uuid, closer.uuid]),
    uuid: crypto.randomUUID(),
  });
  return { song, opener, closer, friday, acoustic };
}

export async function records(database: BackupDatabase) {
  const file = JSON.parse(await database.backup.export()) as Record<
    string,
    unknown
  >;
  delete file.exportedAt;
  return file;
}
