import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CATEGORIES,
  reject,
  recordKey,
  type BackupFile,
  type Category,
  type CategoryRecords,
  type LibrarySongRecord,
  type PracticeSessionRecord,
  type SetlistRecord,
  type SongPresetRecord,
  type TuningRecord,
} from './backup-format';
import {
  asArray,
  asObject,
  base64Length,
  invalidField,
  reader,
  type Reader,
} from './backup-reader';

const FLOAT32_BYTES = 4;

function readLibrarySong(value: unknown, path: string): LibrarySongRecord {
  const r = reader(value, path);
  const record = {
    uuid: r.uuid('uuid'),
    title: r.string('title'),
    artist: r.string('artist'),
    filePath: r.string('filePath'),
    duration: r.number('duration'),
    format: r.string('format'),
    createdAt: r.count('createdAt'),
    beatGrid: r.nullableBlob('beatGrid'),
    downbeatIndices: r.nullableBlob('downbeatIndices'),
    bpm: r.nullableNumber('bpm'),
    waveformPath: r.nullableString('waveformPath'),
  };
  if (
    record.beatGrid !== null &&
    base64Length(record.beatGrid) % FLOAT32_BYTES !== 0
  )
    invalidField(`${path}.beatGrid`, 'expected packed float32 values');
  return record;
}

function readPresetMusic(r: Reader) {
  return {
    uuid: r.uuid('uuid'),
    name: r.string('name'),
    bpm: r.number('bpm'),
    beatsPerBar: r.count('beatsPerBar'),
    subdivision: r.count('subdivision'),
    denominator: r.count('denominator'),
    accents: r.blob('accents'),
    perAccentSounds: r.nullableBlob('perAccentSounds'),
    polyAccents: r.nullableBlob('polyAccents'),
    polyEnabled: r.boolean('polyEnabled'),
    polyBeats: r.count('polyBeats'),
  };
}

function readPresetRig(r: Reader) {
  return {
    sound: r.count('sound'),
    rampEnabled: r.boolean('rampEnabled'),
    rampStartBpm: r.nullableNumber('rampStartBpm'),
    rampEndBpm: r.nullableNumber('rampEndBpm'),
    rampBars: r.nullableCount('rampBars'),
    barMuteEnabled: r.boolean('barMuteEnabled'),
    barMutePlayBars: r.nullableCount('barMutePlayBars'),
    barMuteMuteBars: r.nullableCount('barMuteMuteBars'),
    countInBars: r.count('countInBars'),
  };
}

function readPresetIdentity(r: Reader) {
  return {
    notes: r.nullableString('notes'),
    phaseNudge: r.number('phaseNudge'),
    title: r.nullableString('title'),
    artist: r.nullableString('artist'),
    source: r.nullableString('source'),
    lengthSeconds: r.nullableNumber('lengthSeconds'),
    librarySongUuid: r.nullableUuid('librarySongUuid'),
  };
}

function checkBlobLength(
  path: string,
  encoded: string | null,
  expected: number,
) {
  if (encoded !== null && base64Length(encoded) !== expected)
    invalidField(path, `expected ${String(expected)} bytes`);
}

function readSongPreset(value: unknown, path: string): SongPresetRecord {
  const r = reader(value, path);
  const record = {
    ...readPresetMusic(r),
    ...readPresetRig(r),
    ...readPresetIdentity(r),
  };
  checkBlobLength(`${path}.accents`, record.accents, record.beatsPerBar);
  checkBlobLength(
    `${path}.perAccentSounds`,
    record.perAccentSounds,
    record.beatsPerBar,
  );
  checkBlobLength(`${path}.polyAccents`, record.polyAccents, record.polyBeats);
  return record;
}

function readSetlist(value: unknown, path: string): SetlistRecord {
  const r = reader(value, path);
  return {
    uuid: r.uuid('uuid'),
    name: r.string('name'),
    active: r.boolean('active'),
    presetUuids: r
      .array('presetUuids')
      .map((uuid, index) =>
        reader({ uuid }, `${path}.presetUuids[${String(index)}]`).uuid('uuid'),
      ),
  };
}

function readTuning(value: unknown, path: string): TuningRecord {
  const r = reader(value, path);
  return {
    uuid: r.uuid('uuid'),
    name: r.string('name'),
    notes: r.blob('notes'),
  };
}

function readPracticeSession(
  value: unknown,
  path: string,
): PracticeSessionRecord {
  const r = reader(value, path);
  return {
    uuid: r.uuid('uuid'),
    startTime: r.count('startTime'),
    durationSeconds: r.count('durationSeconds'),
    avgBpm: r.number('avgBpm'),
    setlistUuid: r.nullableUuid('setlistUuid'),
    songsPlayed: r.nullableString('songsPlayed'),
  };
}

const READERS: {
  [C in Category]: (value: unknown, path: string) => CategoryRecords[C][number];
} = {
  librarySongs: readLibrarySong,
  songPresets: readSongPreset,
  setlists: readSetlist,
  tunings: readTuning,
  practiceSessions: readPracticeSession,
};

function readCategory<C extends Category>(
  root: Record<string, unknown>,
  category: C,
  listed: boolean,
): CategoryRecords[C] {
  const path = `$.${category}`;
  if (!listed) {
    if (root[category] !== undefined)
      invalidField(path, 'present but not listed in categories');
    return [];
  }
  const read = READERS[category];
  return asArray(root[category], path).map((value, index) =>
    read(value, `${path}[${String(index)}]`),
  ) as CategoryRecords[C];
}

function readCategories(value: unknown): Category[] {
  const listed = asArray(value, '$.categories');
  const known: readonly unknown[] = CATEGORIES;
  listed.forEach((category, index) => {
    if (!known.includes(category) || listed.indexOf(category) !== index)
      invalidField(`$.categories[${String(index)}]`, 'unknown or repeated');
  });
  return listed as Category[];
}

function readHeader(root: Record<string, unknown>) {
  const { version } = root;
  if (typeof version === 'number' && version !== BACKUP_VERSION)
    reject({ kind: 'unsupportedVersion', version });
  if (root.format !== BACKUP_FORMAT || version !== BACKUP_VERSION)
    reject({ kind: 'malformedFile', reason: 'not a Kitbag backup' });
  return {
    exportedAt: reader(root, '$').string('exportedAt'),
    categories: readCategories(root.categories),
  };
}

function checkIdentities(records: CategoryRecords) {
  for (const category of CATEGORIES) {
    const seen = new Set<string>();
    for (const record of records[category]) {
      const key = recordKey(record);
      if (seen.has(key)) reject({ kind: 'duplicateIdentity', category, key });
      seen.add(key);
    }
  }
}

function brokenLink(path: string, reason: string): never {
  return reject({ kind: 'invalidRelationship', path, reason });
}

function checkReferences(
  records: readonly { ref: string | null; path: string }[],
  targets: readonly { uuid: string }[],
  target: Category,
) {
  const known = new Set(targets.map((record) => record.uuid));
  for (const { ref, path } of records)
    if (ref !== null && !known.has(ref))
      brokenLink(path, `no ${target} with this UUID in the file`);
}

function checkSetlists(records: CategoryRecords) {
  if (records.setlists.filter((setlist) => setlist.active).length > 1)
    invalidField('$.setlists', 'more than one active setlist');
  const items = records.setlists.flatMap((setlist, s) =>
    setlist.presetUuids.map((ref, i) => ({
      ref,
      path: `$.setlists[${String(s)}].presetUuids[${String(i)}]`,
    })),
  );
  checkReferences(items, records.songPresets, 'songPresets');
}

function checkRelationships(file: BackupFile) {
  const { records, categories } = file;
  const has = (category: Category) => categories.includes(category);
  checkSetlists(records);
  if (has('librarySongs'))
    checkReferences(
      records.songPresets.map(({ librarySongUuid }, i) => ({
        ref: librarySongUuid,
        path: `$.songPresets[${String(i)}].librarySongUuid`,
      })),
      records.librarySongs,
      'librarySongs',
    );
  if (has('setlists'))
    checkReferences(
      records.practiceSessions.map(({ setlistUuid }, i) => ({
        ref: setlistUuid,
        path: `$.practiceSessions[${String(i)}].setlistUuid`,
      })),
      records.setlists,
      'setlists',
    );
}

function parseJson(input: string | Uint8Array): Record<string, unknown> {
  const text =
    typeof input === 'string' ? input : new TextDecoder().decode(input);
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    reject({ kind: 'malformedFile', reason: 'not valid JSON' });
  }
  return asObject(root, '$');
}

export function parseBackup(input: string | Uint8Array): BackupFile {
  const root = parseJson(input);
  const header = readHeader(root);
  const records = Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      readCategory(root, category, header.categories.includes(category)),
    ]),
  ) as unknown as CategoryRecords;
  const file: BackupFile = { ...header, version: BACKUP_VERSION, records };
  checkIdentities(records);
  checkRelationships(file);
  return file;
}
