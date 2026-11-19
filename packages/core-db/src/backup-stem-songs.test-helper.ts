import { eq } from 'drizzle-orm';

import { openBackupDatabase, type BackupDatabase } from './backup.test-helper';
import { CLICK_RATE } from './click-rate';
import { GRID_METER } from './meter-override';
import { stems, stemSets } from './schema';
import { createSongLibraryRepository } from './song-library-repository';
import type { NewStemBundle } from './stem-bundle-repository';
import { STEM_SET_SOURCE } from './stem-set-source';
import { TEMPO_MODE, TEMPO_SOURCE } from './tempo-mode';

const RATE = 48000;
const LENGTH_SEC = 200;
const FOLLOW_BPM = 120;
const FOLLOW_ANCHOR_SEC = 0.5;
const BEATS_PER_BAR = 4;
export const JOB = 'job-echo';
export const LOCAL_SPEED = 0.5;
export const TWO_LINES = {
  synced: '[00:12.25]First line\n[00:15.80]Second line',
  plain: null,
  offsetSec: 0,
  instrumental: false,
};
export const THREE_LINES = {
  ...TWO_LINES,
  synced: `${TWO_LINES.synced}\n[00:19.00]Third line`,
};
export const FOLDER_UUID = '7d4c1f8e-2b6a-4f3d-9c1e-5a8b7e6d4c3b';

export const EDITED = {
  title: 'Echo (live)',
  meterBeatsPerBar: GRID_METER.triple,
  barOneSeconds: 1.5,
  speed: 0.75,
  lyricsRetimed: [11.9, 15.2],
  clickGrouping: [3, 3, 2],
  clickRate: CLICK_RATE.double,
  chosenTempoMode: TEMPO_MODE.constant,
  drums: { name: 'Kit', gain: 1.5, muted: false, soloed: true, pitch: -2 },
  vocals: { gain: 0.25, muted: true, soloed: false },
} as const;

export const ROLES = ['vocals', 'drums'];

export function bundle(jobId: string, roles = ROLES): NewStemBundle {
  const folder = `stems/${jobId}`;
  return {
    uuid: crypto.randomUUID(),
    jobId,
    title: 'Echo',
    songTitle: 'Echo',
    artist: 'Charity Gayle',
    folder,
    sampleRate: RATE,
    channels: 2,
    stems: roles.map((role) => ({
      name: role,
      filePath: `${folder}/${role}.flac`,
      waveformPath: null,
      frames: LENGTH_SEC * RATE,
      volume: 1,
      muted: false,
      soloed: false,
      pitch: 0,
    })),
    hasMix: false,
    bpm: null,
    key: null,
    scale: null,
    keyConfidence: null,
    loudnessLufs: null,
    tempoStability: null,
    sections: [],
    beats: [],
    bars: [],
    lyrics: TWO_LINES,
    tempo: {
      mode: TEMPO_MODE.follow,
      bpm: FOLLOW_BPM,
      anchor: FOLLOW_ANCHOR_SEC,
      beatsPerBar: BEATS_PER_BAR,
      source: TEMPO_SOURCE.detected,
    },
  };
}

export function stemSongDatabase() {
  const database = openBackupDatabase();
  return {
    ...database,
    library: createSongLibraryRepository(database.handle),
  };
}

export type StemSongDatabase = ReturnType<typeof stemSongDatabase>;

export async function addStemDeckSong(
  { library }: StemSongDatabase,
  jobId = JOB,
) {
  return library.insertStemBundle(bundle(jobId));
}

export async function addFolderSong(database: StemSongDatabase, roles = ROLES) {
  const id = await database.library.insertStemBundle(
    bundle('folder-import', roles),
  );
  await database.handle.db
    .update(stemSets)
    .set({
      source: STEM_SET_SOURCE.folder,
      stemdeckJobId: null,
      uuid: FOLDER_UUID,
    })
    .where(eq(stemSets.id, id));
  return id;
}

export async function edit({ library, handle }: StemSongDatabase, id: number) {
  const set = await library.readStemSet(id);
  const vocals = set?.stems.find(({ role }) => role === 'vocals');
  const drums = set?.stems.find(({ role }) => role === 'drums');
  if (vocals === undefined || drums === undefined) throw new Error('setup');
  await library.renameStemSet(id, EDITED.title);
  await library.renameStem(drums.id, EDITED.drums.name);
  await library.saveStemSetMeterOverride(id, EDITED);
  await library.saveLyricsRetimed(id, EDITED.lyricsRetimed);
  await library.saveStemSetClick(id, EDITED);
  await library.saveStemSetChosenTempoMode(id, EDITED.chosenTempoMode);
  await handle.db
    .update(stemSets)
    .set({ speed: EDITED.speed })
    .where(eq(stemSets.id, id));
  await handle.db
    .update(stems)
    .set({ pitch: EDITED.drums.pitch })
    .where(eq(stems.id, drums.id));
  await library.saveStemMix([
    { id: vocals.id, volume: EDITED.vocals.gain, ...EDITED.vocals },
    { id: drums.id, volume: EDITED.drums.gain, ...EDITED.drums },
  ]);
}

export const expectedEdits = {
  title: EDITED.title,
  meterBeatsPerBar: EDITED.meterBeatsPerBar,
  barOneSeconds: EDITED.barOneSeconds,
  speed: EDITED.speed,
  lyricsRetimed: EDITED.lyricsRetimed,
  clickGrouping: EDITED.clickGrouping,
  clickRate: EDITED.clickRate,
  chosenTempoMode: EDITED.chosenTempoMode,
};

export function mixOf(
  set: Awaited<ReturnType<StemSongDatabase['library']['readStemSet']>>,
) {
  return set?.stems.map(({ role, name, volume, muted, soloed, pitch }) => ({
    role,
    name,
    volume,
    muted,
    soloed,
    pitch,
  }));
}

export const EDITED_MIX = [
  {
    role: 'vocals',
    name: 'vocals',
    volume: EDITED.vocals.gain,
    muted: EDITED.vocals.muted,
    soloed: EDITED.vocals.soloed,
    pitch: 0,
  },
  {
    role: 'drums',
    name: EDITED.drums.name,
    volume: EDITED.drums.gain,
    muted: EDITED.drums.muted,
    soloed: EDITED.drums.soloed,
    pitch: EDITED.drums.pitch,
  },
];

export async function stemSetCount({ handle }: BackupDatabase) {
  return (await handle.db.select({ id: stemSets.id }).from(stemSets)).length;
}

export async function setSpeed(
  { handle }: StemSongDatabase,
  id: number,
  speed: number,
) {
  await handle.db.update(stemSets).set({ speed }).where(eq(stemSets.id, id));
}
