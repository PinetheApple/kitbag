export {
  openDatabase,
  type KitbagDatabase,
  type SetlistRepository,
  type SongPresetRepository,
} from './client';
export type { Preferences } from './preferences';
export type { PracticeRepository, PracticeStats } from './practice-repository';
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
export { STEM_SET_SOURCE, type StemSetSource } from './stem-set-source';
export { ANALYSIS_STATUS, type AnalysisStatus } from './analysis-status';
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
export type { ApplyOptions, BackupService } from './backup';
export type { CategoryPlan, ImportOptions, ImportPlan } from './backup-plan';
export {
  MAX_MIDI_NOTE,
  tuningViolation,
  type TuningShape,
} from './tuning-rules';
