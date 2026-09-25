export const BACKUP_FORMAT = 'kitbag-backup';
export const BACKUP_VERSION = 4;
export const MS_PER_SECOND = 1000;

export const CATEGORIES = [
  'librarySongs',
  'songPresets',
  'setlists',
  'tunings',
  'practiceSessions',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DEFAULT_IMPORT_CATEGORIES: readonly Category[] = [
  'songPresets',
  'setlists',
  'tunings',
];

export interface LibrarySongRecord {
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
}

export interface SongPresetRecord {
  uuid: string;
  name: string;
  bpm: number;
  beatsPerBar: number;
  subdivision: number;
  denominator: number;
  accents: string;
  perAccentSounds: string | null;
  polyAccents: string | null;
  polyEnabled: boolean;
  polyBeats: number;
  sound: number;
  rampEnabled: boolean;
  rampStartBpm: number | null;
  rampEndBpm: number | null;
  rampBars: number | null;
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

export interface SetlistRecord {
  uuid: string;
  name: string;
  active: boolean;
  presetUuids: string[];
}

export interface TuningRecord {
  uuid: string;
  name: string;
  notes: string;
}

export interface PracticeSessionRecord {
  uuid: string;
  startTime: number;
  durationSeconds: number;
  avgBpm: number;
  setlistUuid: string | null;
  songsPlayed: string | null;
}

export interface CategoryRecords {
  librarySongs: LibrarySongRecord[];
  songPresets: SongPresetRecord[];
  setlists: SetlistRecord[];
  tunings: TuningRecord[];
  practiceSessions: PracticeSessionRecord[];
}

export type BackupRecord = CategoryRecords[Category][number];

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
  | { kind: 'stalePlan' };

export interface Conflict {
  category: Category;
  key: string;
  label: string;
}

export type Result<T> =
  { ok: true; value: T } | { ok: false; error: ImportFailure };

export class ImportRejected extends Error {
  constructor(readonly failure: ImportFailure) {
    super(failure.kind);
  }
}

export function reject(failure: ImportFailure): never {
  throw new ImportRejected(failure);
}

export function recordKey(record: BackupRecord): string {
  return record.uuid;
}

export function recordLabel(record: BackupRecord): string {
  if ('name' in record) return record.name;
  if ('title' in record) return record.title;
  return new Date(record.startTime * MS_PER_SECOND).toISOString();
}
