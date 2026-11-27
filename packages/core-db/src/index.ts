export {
  DatabaseOpenError,
  type DatabaseOpenErrorKind,
} from './database-open-error';
export {
  SQLITE_CANTOPEN,
  SQLITE_FULL,
  SQLITE_READONLY,
  sqliteResultCode,
} from './sqlite-result-codes';
export {
  DATABASE_NAME,
  openDatabase,
  type KitbagDatabase,
  type SetlistRepository,
  type SongPresetRepository,
} from './client';
export type { LinkedPresetValues } from './song-preset-repository';
export {
  queueColumnsOf,
  queuedSongOf,
  sameQueuedSong,
  type PlayQueueEntry,
  type PlayQueueRepository,
  type QueuedSong,
} from './play-queue-repository';
export type { Preferences } from './preferences';
export { COUNT_IN_PREFERENCE_KEYS } from './count-in-preferences';
export { RIG_PREFERENCE_KEYS } from './rig-preferences';
export {
  APPEARANCE_PREFERENCE_KEYS,
  HOME_LAYOUT_KEY,
} from './appearance-preferences';
export { STANDALONE_METRONOME_KEY } from './standalone-metronome-preference';
export { GET_SONG_BPM_KEY_PREFERENCE } from './getsongbpm-key-preference';
export type {
  DeletedPracticeSession,
  NewPracticeSession,
  PracticeRepository,
  PracticeSessionListing,
  PracticeStats,
  SavedPracticeSession,
} from './practice-repository';
export {
  isStemSong,
  loggedSettingsOf,
  PRACTICE_LOG_VERSION,
  presetFieldsOfLogged,
  STRETCH_END,
  type LoggedCountIn,
  type LoggedPresetSong,
  type LoggedSetlist,
  type LoggedSettings,
  type LoggedSong,
  type LoggedStemSong,
  type LoggedStretch,
  type PracticeLog,
  type StretchEnd,
  type StretchSettingsFields,
  type TempoChange,
} from './practice-log';
export type {
  RouteLatency,
  RouteLatencyRepository,
} from './route-latency-repository';
export {
  MAX_TOOL_DATA_KEY_BYTES,
  MAX_TOOL_DATA_VALUE_BYTES,
  ToolDataRejected,
  type ToolData,
  type ToolDataEntry,
  type ToolDataRejection,
  type ToolDataRepository,
} from './tool-data-repository';
export {
  BPM_CACHE_TTL_MS,
  type BpmCacheRepository,
  type CachedBpm,
} from './bpm-cache-repository';
export {
  BPM_LOOKUP_SOURCE,
  isBpmLookupSource,
  type BpmLookupSource,
} from './bpm-lookup-source';
export {
  artistCredits,
  artistMatchText,
  songMatchKey,
  songMatchText,
  type SongIdentity,
} from './song-match-key';
export type {
  BarMark,
  BundleStem,
  ExistingStemSet,
  NewStemBundle,
  StemBundleReplacement,
  StemMix,
  StemSetFiles,
  StemSetRecord,
  StoredLyrics,
  StoredSection,
  StoredStem,
} from './stem-bundle-repository';
export {
  STEM_SET_PITCH,
  type StemKey,
  type StemSetSpeedKey,
} from './stem-speed-key';
export { MS_PER_SECOND, SECONDS_PER_MINUTE, UNITY_GAIN } from './units';
export { parseLrc, plainLyricTexts, type LyricLine } from './lrc';
export {
  retimeFits,
  type LyricLineTimes,
  type LyricsSource,
} from './stem-lyrics';
export type { StemSetIdentity } from './stem-set-match';
export { SAME_SONG_DURATION_TOLERANCE_SEC } from './stem-set-match';
export { STEM_SET_SOURCE, type StemSetSource } from './stem-set-source';
export { ANALYSIS_STATUS, type AnalysisStatus } from './analysis-status';
export { CLICK_RATE, CLICK_RATES, type ClickRate } from './click-rate';
export {
  groupBeats,
  MAX_CLICK_GROUPS,
  NO_CLICK,
  stemSetClickViolation,
  type StemSetClick,
  type StemSetClickPatch,
  type StemSetClickViolation,
} from './click-settings';
export {
  GRID_METER,
  GRID_METERS,
  type GridMeter,
  isGridMeter,
  type MeterOverride,
  type MeterOverridePatch,
  meterOverrideOf,
  NO_METER_OVERRIDE,
} from './meter-override';
export {
  correctedBpm,
  isTempoCorrection,
  TEMPO_CORRECTION,
  TEMPO_CORRECTIONS,
  TEMPO_RATIO,
  type TempoCorrection,
  type TempoRatio,
} from './tempo-correction';
export {
  TEMPO_MAX_BPM,
  TEMPO_MIN_BPM,
  TEMPO_MODE,
  TEMPO_SOURCE,
  type TempoMode,
  type TempoSource,
} from './tempo-mode';
export {
  effectiveCorrection,
  type ManualTempo,
  type ManualTempoChange,
} from './manual-tempo';
export {
  bundleTempoOf,
  bundleTempoViolation,
  canBuildTempoMode,
  type BundleTempo,
  type FittedTempo,
  type StoredTempo,
  type UntimedStemSet,
} from './stem-tempo';
export type {
  AnalysisResultRecord,
  LibraryRow,
  LibrarySongRow,
  LibraryStemSetRow,
  NewLibrarySong,
  SongLibraryRepository,
  StoredAnalysis,
  AnalysisOutcome,
  SongFiles,
  SongRecord,
} from './song-library-repository';
export type {
  NewSongPreset,
  NewTuning,
  Setlist,
  SetlistItem,
  SongPreset,
  Tuning,
  TuningRepository,
} from './repository';
export {
  CATEGORIES,
  DEFAULT_IMPORT_CATEGORIES,
  type Category,
  type Conflict,
  type ImportFailure,
  type ImportMode,
  type Resolution,
  type Resolutions,
  type ImportResult,
  type TuningRecord,
} from './backup-format';
export type { StaleSlots } from './backup-apply';
export type { ApplyOptions, ApplyReport, BackupService } from './backup';
export type { KeptBeforeReplace } from './backup-before-replace';
export type { BackupRules } from './backup-rules';
export type { MigrationCopyFiles } from './migration-copy';
export {
  freshClickSoundFileName,
  type ClickSoundFiles,
} from './click-sound-files';
export type {
  ClickSound,
  ClickSoundRepository,
  RemovedClickSound,
} from './click-sound-repository';
export type { CategoryPlan, ImportOptions, ImportPlan } from './backup-plan';
export { normalizePolyAgainst, TICK_SOUND } from './preset-rules';
export {
  MAX_MIDI_NOTE,
  tuningViolation,
  type TuningShape,
} from './tuning-rules';
