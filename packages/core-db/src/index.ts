export {
  DATABASE_NAME,
  openDatabase,
  type KitbagDatabase,
  type SetlistRepository,
  type SongPresetRepository,
} from './client';
export type { Preferences } from './preferences';
export { COUNT_IN_PREFERENCE_KEYS } from './count-in-preferences';
export { STANDALONE_METRONOME_KEY } from './standalone-metronome-preference';
export type {
  NewPracticeSession,
  PracticeRepository,
  PracticeStats,
} from './practice-repository';
export type {
  RouteLatency,
  RouteLatencyRepository,
} from './route-latency-repository';
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
export type { LyricLineTimes } from './stem-lyrics';
export type { StemSetIdentity } from './stem-set-match';
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
  TEMPO_MODE,
  TEMPO_SOURCE,
  type TempoMode,
  type TempoSource,
} from './tempo-mode';
export {
  bundleTempoOf,
  bundleTempoViolation,
  canBuildTempoMode,
  type BundleTempo,
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
  MS_PER_SECOND,
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
export { normalizePolyAgainst } from './preset-rules';
export {
  MAX_MIDI_NOTE,
  tuningViolation,
  type TuningShape,
} from './tuning-rules';
