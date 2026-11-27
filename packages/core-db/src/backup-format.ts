import { APPEARANCE_STORED_KEYS } from './appearance-preferences';
import type { ClickRate } from './click-rate';
import type { ClickSound } from './click-sound-repository';
import { COUNT_IN_STORED_KEYS } from './count-in-preferences';
import type { MeterOverride } from './meter-override';
import { RIG_STORED_KEYS } from './rig-preferences';
import type { RouteLatency } from './route-latency-repository';
import { STANDALONE_METRONOME_KEY } from './standalone-metronome-preference';
import type { LyricLineTimes, LyricsSource } from './stem-lyrics';
import type { BundleTempo, TempoColumns } from './stem-tempo';
import { STEM_SET_SOURCE, type StemSetSource } from './stem-set-source';
import type { TempoCorrection } from './tempo-correction';
import type { TempoMode } from './tempo-mode';
import { MS_PER_SECOND } from './units';

export const BACKUP_FORMAT = 'kitbag-backup';
export const BACKUP_VERSION = 5;
export const OLDEST_RESTORABLE_BACKUP_VERSION = 4;

export const CATEGORIES = [
  'librarySongs',
  'songPresets',
  'setlists',
  'tunings',
  'practiceSessions',
  'countInSettings',
  'metronomeSettings',
  'clickSounds',
  'stemSongs',
  'rigSettings',
  'appearanceSettings',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DEFAULT_IMPORT_CATEGORIES: readonly Category[] = [
  'songPresets',
  'setlists',
  'tunings',
  'countInSettings',
  'metronomeSettings',
  'clickSounds',
  'stemSongs',
  'rigSettings',
  'appearanceSettings',
];

export interface LibrarySongRecord
  extends Partial<MeterOverride>, Partial<TempoColumns> {
  uuid: string;
  title: string;
  artist: string;
  filePath: string;
  duration: number;
  format: string;
  createdAt: number;
  beatGrid: string | null;
  downbeatIndices: string | null;
  bpm: number | null;
  waveformPath: string | null;
  analysisVersion?: number | null;
  tempoCorrection?: TempoCorrection | null;
  speed?: number;
}

export interface SongPresetRecord {
  uuid: string;
  name: string;
  bpm: number | null;
  beatsPerBar: number;
  subdivision: number;
  denominator: number;
  accents: string;
  perAccentSounds: string | null;
  polyAccents: string | null;
  polyEnabled: boolean;
  polyBeats: number;
  polyAgainst: number;
  sound: number;
  rampEnabled: boolean;
  rampStartBpm: number | null;
  rampEndBpm: number | null;
  rampLength: number | null;
  // v4 files from before schema v13 omit it and read as a step of 1.
  rampStep: number;
  // Always written; v4 files from before schema v12 omit both and read as bars, no loop.
  rampUnit: number;
  rampLoop: boolean;
  barMuteEnabled: boolean;
  barMutePlayBars: number | null;
  barMuteMuteBars: number | null;
  countInBars: number;
  notes: string | null;
  phaseNudge: number;
  title: string | null;
  artist: string | null;
  source: string | null;
  lengthSeconds: number | null;
  librarySongUuid: string | null;
}

export type SetlistItemRecord = { preset: string } | { stemSong: string };

export interface SetlistRecord {
  uuid: string;
  name: string;
  active: boolean;
  presetUuids: string[];
  items?: SetlistItemRecord[];
}

export const itemPresets = (items: readonly SetlistItemRecord[]) =>
  items.flatMap((item) => ('preset' in item ? [item.preset] : []));

export interface TuningRecord {
  uuid: string;
  name: string;
  notes: string;
  // Always written; v4 files from before schema v10 omit it and read as guitar.
  instrument: number;
}

export interface PracticeSessionRecord {
  uuid: string;
  startTime: number;
  durationSeconds: number;
  avgBpm: number;
  setlistUuid: string | null;
  songsPlayed: string | null;
  setlistName: string | null;
  log: string | null;
}

// The value stays the stored text: only the app knows which values are valid,
// and it reads anything else as the default.
export interface PreferenceRecord {
  key: string;
  value: string;
}

export type RouteLatencyRecord = RouteLatency;

export type RigRecord = PreferenceRecord | RouteLatencyRecord;

export interface ClickSoundRecord {
  slot: number;
  uuid: string;
  name: string;
  wav: string;
}

export interface StemMixRecord {
  role: string;
  name: string | null;
  gain: number;
  muted: boolean;
  soloed: boolean;
  pitch: number;
}

export interface StemSongRecord extends MeterOverride {
  source: StemSetSource;
  stemdeckJobId: string | null;
  uuid: string | null;
  label: string;
  title: string | null;
  speed: number;
  pitch: number;
  lyricsRetimed: LyricLineTimes | null;
  clickGrouping: readonly number[];
  clickRate: ClickRate;
  chosenTempoMode: TempoMode | null;
  stems: StemMixRecord[];
}

export interface CategoryRecords {
  librarySongs: LibrarySongRecord[];
  songPresets: SongPresetRecord[];
  setlists: SetlistRecord[];
  tunings: TuningRecord[];
  practiceSessions: PracticeSessionRecord[];
  countInSettings: PreferenceRecord[];
  metronomeSettings: PreferenceRecord[];
  clickSounds: ClickSoundRecord[];
  stemSongs: StemSongRecord[];
  rigSettings: RigRecord[];
  appearanceSettings: PreferenceRecord[];
}

export type BackupRecord = CategoryRecords[Category][number];

export type LocalStemSong = StemSongRecord & {
  lyrics: LyricsSource | null;
  tempo: BundleTempo | null;
};

export type LocalRecords = Omit<
  CategoryRecords,
  'clickSounds' | 'stemSongs'
> & {
  clickSounds: ClickSound[];
  stemSongs: LocalStemSong[];
};

export type LocalRecord = LocalRecords[Category][number];

export interface BackupFile {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  categories: Category[];
  records: CategoryRecords;
}

export type ImportMode = 'merge' | 'replace';
export type Resolution = 'mine' | 'theirs';
export type Resolutions = Partial<Record<Category, Record<string, Resolution>>>;

export type ImportFailure =
  | { kind: 'malformedFile'; reason: string }
  | { kind: 'unsupportedVersion'; version: number }
  | { kind: 'invalidField'; path: string; reason: string }
  | { kind: 'invalidRelationship'; path: string; reason: string }
  | { kind: 'duplicateIdentity'; category: Category; key: string }
  | { kind: 'categoryNotInFile'; category: Category }
  | { kind: 'missingDependency'; category: Category; requires: Category }
  | { kind: 'unresolvedConflicts'; conflicts: Conflict[] }
  | { kind: 'replaceNotConfirmed' }
  | { kind: 'stalePlan' }
  | { kind: 'snapshotFailed'; reason: string }
  | { kind: 'databaseError'; reason: string };

export interface Conflict {
  category: Category;
  key: string;
  label: string;
}

export type ImportResult<T> =
  { ok: true; value: T } | { ok: false; error: ImportFailure };

export class ImportRejected extends Error {
  constructor(readonly failure: ImportFailure) {
    super(failure.kind);
  }
}

export function reject(failure: ImportFailure): never {
  throw new ImportRejected(failure);
}

export const REFERENCES = [
  {
    source: 'songPresets',
    field: 'librarySongUuid',
    localColumn: 'librarySongId',
    target: 'librarySongs',
  },
  {
    source: 'practiceSessions',
    field: 'setlistUuid',
    localColumn: 'setlistId',
    target: 'setlists',
  },
] as const satisfies readonly {
  source: Category;
  field: string;
  localColumn: string;
  target: Category;
}[];

export type Reference = (typeof REFERENCES)[number];

export function referenceOf(
  record: BackupRecord,
  reference: Reference,
): string | null {
  const value = (record as unknown as Record<string, unknown>)[reference.field];
  return typeof value === 'string' ? value : null;
}

export const PREFERENCE_KEYS = {
  countInSettings: COUNT_IN_STORED_KEYS,
  metronomeSettings: [STANDALONE_METRONOME_KEY],
  rigSettings: RIG_STORED_KEYS,
  appearanceSettings: APPEARANCE_STORED_KEYS,
} as const satisfies Partial<Record<Category, readonly string[]>>;

export type PreferenceCategory = keyof typeof PREFERENCE_KEYS;

export function isPreferenceCategory(
  category: Category,
): category is PreferenceCategory {
  return category in PREFERENCE_KEYS;
}

function isPreference(
  category: Category,
  record: BackupRecord | LocalRecord,
): record is PreferenceRecord {
  return isPreferenceCategory(category) && 'key' in record;
}

export function stemSongKey(record: StemSongRecord): string {
  const identity =
    record.source === STEM_SET_SOURCE.stemdeck
      ? record.stemdeckJobId
      : record.uuid;
  return `${record.source}:${identity ?? ''}`;
}

const ROUTE_KEY_PREFIX = 'route:';

export const routeLatencyKey = (route: string) => `${ROUTE_KEY_PREFIX}${route}`;

export function recordKey(
  category: Category,
  record: BackupRecord | LocalRecord,
): string {
  if (isPreference(category, record)) return record.key;
  if ('route' in record) return routeLatencyKey(record.route);
  if (category === 'clickSounds' && 'slot' in record)
    return String(record.slot);
  if ('stems' in record) return stemSongKey(record);
  return record.uuid;
}

export function recordLabel(category: Category, record: BackupRecord): string {
  if (isPreference(category, record)) return record.key;
  if ('route' in record) return record.name ?? record.route;
  if ('label' in record) return record.label;
  if ('name' in record) return record.name;
  if ('title' in record) return record.title;
  return new Date(record.startTime * MS_PER_SECOND).toISOString();
}
