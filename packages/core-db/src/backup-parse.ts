import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  OLDEST_RESTORABLE_BACKUP_VERSION,
  CATEGORIES,
  itemPresets,
  PREFERENCE_KEYS,
  reject,
  recordKey,
  referenceOf,
  REFERENCES,
  type BackupFile,
  type Category,
  type CategoryRecords,
  type ClickSoundRecord,
  type LibrarySongRecord,
  type PracticeSessionRecord,
  type PreferenceCategory,
  type PreferenceRecord,
  type RigRecord,
  type RouteLatencyRecord,
  type SetlistItemRecord,
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
import { readSongTempo } from './backup-song-tempo';
import { readStemSong } from './backup-stem-song-read';
import { decodeBase64, presetBytes } from './base64';
import { isClickSoundSlot } from './click-sound-repository';
import {
  CUSTOM_SOUND_SLOTS,
  MAX_CUSTOM_SOUND_WAV_BYTES,
  MIN_RAMP_STEP,
  normalizePolyAgainst,
  POLY_AGAINST_BAR,
  presetViolation,
  RAMP_UNITS,
} from './preset-rules';
import { meterOverrideViolation, type GridMeter } from './meter-override';
import { readSongSpeed } from './song-speed';
import { isTempoCorrection, storedTempoCorrection } from './tempo-correction';
import { INSTRUMENTS, tuningViolation } from './tuning-rules';

const FLOAT32_BYTES = 4;

function readTempoCorrection(r: Reader) {
  const { tempoCorrection } = r.presentNullableMember(
    'tempoCorrection',
    isTempoCorrection,
  );
  if (tempoCorrection === undefined) return {};
  return {
    tempoCorrection:
      tempoCorrection === null ? null : storedTempoCorrection(tempoCorrection),
  };
}

function readSongGrid(r: Reader, path: string) {
  const fields = {
    ...r.presentNullableCount('analysisVersion'),
    ...r.presentNullableCount('meterBeatsPerBar'),
    ...r.presentNullableNumber('barOneSeconds'),
  };
  const violation = meterOverrideViolation(fields);
  if (violation) invalidField(`${path}.${violation.field}`, violation.reason);
  return {
    ...(fields as typeof fields & { meterBeatsPerBar?: GridMeter | null }),
    ...readTempoCorrection(r),
    ...readSongSpeed(r, path),
  };
}

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
    ...readSongGrid(r, path),
    ...readSongTempo(r, path),
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
    bpm: r.nullableNumber('bpm'),
    beatsPerBar: r.count('beatsPerBar'),
    subdivision: r.count('subdivision'),
    denominator: r.count('denominator'),
    accents: r.blob('accents'),
    perAccentSounds: r.nullableBlob('perAccentSounds'),
    polyAccents: r.nullableBlob('polyAccents'),
    polyEnabled: r.boolean('polyEnabled'),
    polyBeats: r.count('polyBeats'),
    polyAgainst: r.optionalCount('polyAgainst', POLY_AGAINST_BAR),
  };
}

function readPresetRig(r: Reader) {
  return {
    sound: r.count('sound'),
    rampEnabled: r.boolean('rampEnabled'),
    rampStartBpm: r.nullableNumber('rampStartBpm'),
    rampEndBpm: r.nullableNumber('rampEndBpm'),
    rampLength: r.nullableNumberOr('rampLength', 'rampBars'),
    rampStep: r.optionalNumber('rampStep', MIN_RAMP_STEP),
    rampUnit: r.optionalCount('rampUnit', RAMP_UNITS.bars),
    rampLoop: r.optionalBoolean('rampLoop', false),
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

function readSongPreset(value: unknown, path: string): SongPresetRecord {
  const r = reader(value, path);
  const record = {
    ...readPresetMusic(r),
    ...readPresetRig(r),
    ...readPresetIdentity(r),
  };
  const violation = presetViolation({
    ...record,
    ...presetBytes(record),
  });
  if (violation) invalidField(`${path}.${violation.field}`, violation.reason);
  return {
    ...record,
    polyAgainst: normalizePolyAgainst(record.polyAgainst, record.beatsPerBar),
  };
}

function readSetlistItem(value: unknown, path: string): SetlistItemRecord {
  const r = reader(value, path);
  const { preset, stemSong } = asObject(value, path);
  if ((preset === undefined) === (stemSong === undefined))
    invalidField(path, 'expected one of preset or stemSong');
  return preset === undefined
    ? { stemSong: r.string('stemSong') }
    : { preset: r.uuid('preset') };
}

function readSetlistItems(value: unknown, path: string, presetUuids: string[]) {
  const listed = asObject(value, path).items;
  if (listed === undefined) return {};
  const items = asArray(listed, `${path}.items`).map((item, index) =>
    readSetlistItem(item, `${path}.items[${String(index)}]`),
  );
  if (JSON.stringify(itemPresets(items)) !== JSON.stringify(presetUuids))
    invalidField(`${path}.items`, 'preset entries differ from presetUuids');
  return { items };
}

function readSetlist(value: unknown, path: string): SetlistRecord {
  const r = reader(value, path);
  const presetUuids = r
    .array('presetUuids')
    .map((uuid, index) =>
      reader({ uuid }, `${path}.presetUuids[${String(index)}]`).uuid('uuid'),
    );
  return {
    uuid: r.uuid('uuid'),
    name: r.string('name'),
    active: r.boolean('active'),
    presetUuids,
    ...readSetlistItems(value, path, presetUuids),
  };
}

function readTuning(value: unknown, path: string): TuningRecord {
  const r = reader(value, path);
  const record = {
    uuid: r.uuid('uuid'),
    name: r.string('name'),
    notes: r.blob('notes'),
    instrument: r.optionalCount('instrument', INSTRUMENTS.guitar),
  };
  const violation = tuningViolation({
    instrument: record.instrument,
    notes: Array.from(decodeBase64(record.notes)),
  });
  if (violation) invalidField(`${path}.${violation.field}`, violation.reason);
  return record;
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
    setlistName: r.optionalNullableString('setlistName'),
    log: r.optionalNullableString('log'),
  };
}

function readClickSound(value: unknown, path: string): ClickSoundRecord {
  const r = reader(value, path);
  const record = {
    slot: r.count('slot'),
    uuid: r.uuid('uuid'),
    name: r.string('name'),
    wav: r.blob('wav'),
  };
  if (!isClickSoundSlot(record.slot))
    invalidField(
      `${path}.slot`,
      `expected 0–${String(CUSTOM_SOUND_SLOTS - 1)}`,
    );
  if (record.name.trim() === '') invalidField(`${path}.name`, 'expected text');
  const bytes = base64Length(record.wav);
  if (bytes === 0 || bytes > MAX_CUSTOM_SOUND_WAV_BYTES)
    invalidField(
      `${path}.wav`,
      `expected 1–${String(MAX_CUSTOM_SOUND_WAV_BYTES)} audio bytes`,
    );
  return record;
}

function preferenceReader(category: PreferenceCategory) {
  const keys: readonly string[] = PREFERENCE_KEYS[category];
  return (value: unknown, path: string): PreferenceRecord => {
    const r = reader(value, path);
    const record = { key: r.string('key'), value: r.string('value') };
    if (!keys.includes(record.key))
      invalidField(`${path}.key`, `not a ${category} key`);
    return record;
  };
}

const readRigPreference = preferenceReader('rigSettings');

function readRouteLatency(value: unknown, path: string): RouteLatencyRecord {
  const r = reader(value, path);
  return {
    route: r.string('route'),
    offsetMs: r.number('offsetMs'),
    name: r.nullableString('name'),
    kind: r.nullableString('kind'),
  };
}

function readRigSetting(value: unknown, path: string): RigRecord {
  return 'route' in asObject(value, path)
    ? readRouteLatency(value, path)
    : readRigPreference(value, path);
}

const READERS: {
  [C in Category]: (value: unknown, path: string) => CategoryRecords[C][number];
} = {
  librarySongs: readLibrarySong,
  songPresets: readSongPreset,
  setlists: readSetlist,
  tunings: readTuning,
  practiceSessions: readPracticeSession,
  countInSettings: preferenceReader('countInSettings'),
  metronomeSettings: preferenceReader('metronomeSettings'),
  clickSounds: readClickSound,
  stemSongs: readStemSong,
  rigSettings: readRigSetting,
  appearanceSettings: preferenceReader('appearanceSettings'),
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

// A current-version reader refuses a category it does not know rather than
// dropping its records, so one it has never seen means a newer writer.
function readCategories(value: unknown, version: number): Category[] {
  const listed = asArray(value, '$.categories');
  const known: readonly unknown[] = CATEGORIES;
  listed.forEach((category, index) => {
    const repeated = listed.indexOf(category) !== index;
    if (known.includes(category) && !repeated) return;
    if (version === BACKUP_VERSION && typeof category === 'string' && !repeated)
      reject({ kind: 'unsupportedVersion', version });
    invalidField(`$.categories[${String(index)}]`, 'unknown or repeated');
  });
  return listed as Category[];
}

const isRestorableVersion = (version: unknown): version is number =>
  typeof version === 'number' &&
  version >= OLDEST_RESTORABLE_BACKUP_VERSION &&
  version <= BACKUP_VERSION;

function readHeader(root: Record<string, unknown>) {
  const { version, format } = root;
  const foreign = format !== undefined && format !== BACKUP_FORMAT;
  if (!foreign && typeof version === 'number' && !isRestorableVersion(version))
    reject({ kind: 'unsupportedVersion', version });
  if (format !== BACKUP_FORMAT || !isRestorableVersion(version))
    reject({ kind: 'malformedFile', reason: 'not a Kitbag backup' });
  return {
    exportedAt: reader(root, '$').string('exportedAt'),
    categories: readCategories(root.categories, version),
  };
}

function checkIdentities(records: CategoryRecords) {
  for (const category of CATEGORIES) {
    const seen = new Set<string>();
    for (const record of records[category]) {
      const key = recordKey(category, record);
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
  checkSetlists(records);
  for (const reference of REFERENCES) {
    const { source, field, target } = reference;
    if (!categories.includes(target)) continue;
    const refs = records[source].map((record, index) => ({
      ref: referenceOf(record, reference),
      path: `$.${source}[${String(index)}].${field}`,
    }));
    checkReferences(refs, records[target], target);
  }
}

function parseJson(text: string): Record<string, unknown> {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    reject({ kind: 'malformedFile', reason: 'not valid JSON' });
  }
  return asObject(root, '$');
}

export function parseBackup(input: string): BackupFile {
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