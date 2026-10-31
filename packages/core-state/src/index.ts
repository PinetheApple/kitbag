export { useMetronome } from './metronome/useMetronome.ts';
export { practiceElapsedMs, type PracticeClock } from './metronome/practice.ts';
export {
  BPM_BOUNDS,
  DEFAULT_BPM,
  DEFAULT_POLY_BEATS,
  DEFAULT_TRAINER_BARS,
  createMetronomeStore,
  metronomeStore,
  type MetronomeStore,
  type MetronomeConfig,
  type MetronomeActions,
  type RampConfig,
  type BarMuteConfig,
  type PerAccentSounds,
  type CountInConfig,
  type Denominator,
  type CountInBars,
} from './metronome/store.ts';
export {
  clampRampInterval,
  cycleAccentValue,
  rampIntervalBounds,
  initialAccents,
  resizeAccents,
} from './metronome/config.ts';
export { beatGroupSizes, groupStartAccents } from './metronome/meterGroups.ts';
export {
  effectivePolyAgainst,
  normalizePolyAgainst,
  stepPolyAgainst,
} from './metronome/polyAgainst.ts';
export type {
  EngineBpm,
  MetronomeCommands,
  NowFrame,
} from './metronome/commands.ts';
export {
  configureMetronomeRuntime,
  type MetronomeRuntime,
} from './metronome/runtime.ts';
export { useLastTool } from './lastTool/useLastTool.ts';
export {
  configureLastToolPersistence,
  createLastToolStore,
  getLastToolStore,
  type LastToolPersistence,
  type LastToolStore,
} from './lastTool/store.ts';
export { useAppearance } from './appearance/useAppearance.ts';
export {
  configureAppearancePersistence,
  createAppearanceStore,
  DEFAULT_APPEARANCE,
  getAppearanceStore,
  THEME_CHOICES,
  type AppearanceKey,
  type AppearancePersistence,
  type AppearanceSettings,
  type AppearanceStore,
  type ThemeChoice,
} from './appearance/store.ts';
export { useTuner } from './tuner/useTuner.ts';
export {
  allStringsTuned,
  createTunerStore,
  tunerStore,
  type TunerStoreDeps,
} from './tuner/store.ts';
export { isValidTuning, tuningFromCustom } from './tuner/customTunings.ts';
export type {
  CustomTuning,
  MicStatus,
  TunerActions,
  TunerCommandError,
  TunerMode,
  TunerState,
  TunerStore,
  TunerTuning,
} from './tuner/types.ts';
export { MAX_MIDI_NOTE } from '@kitbag/core-db';
export { MAX_BUSY_RETRIES, type TunerCommands } from './tuner/commands.ts';
export {
  configureTunerRuntime,
  configureTunings,
  type AppActivity,
  type AppActivitySource,
  type MicPermission,
  type MicPermissionSource,
  type TunerRuntime,
} from './tuner/runtime.ts';
export { useLibrary } from './library/useLibrary.ts';
export {
  createLibraryStore,
  libraryStore,
  type LibraryStore,
  type LoadedSong,
  type PresetEdit,
  type SearchResults,
} from './library/store.ts';
export {
  configureLibrary,
  type LibraryRepositories,
} from './library/runtime.ts';
export type { SetlistEntry, SetlistSummary } from './library/snapshot.ts';
export {
  activeSetlistOf,
  adjacentEntry,
  SONG_STEP,
  type SongStep,
} from './library/setlistPosition.ts';
export { activeSetView, type ActiveSet } from './library/activeSet.ts';
export { transportSetlistOf } from './library/transportSetlist.ts';
export {
  accentsOf,
  byteList,
  perAccentSoundsOf,
  rampUnitOf,
  toBlob,
} from './library/presetMapping.ts';
export type { Setlist, SetlistItem, SongPreset } from '@kitbag/core-db';
export { useSongLibrary } from './songLibrary/useSongLibrary.ts';
export {
  createSongLibraryStore,
  songLibraryStore,
  type LibraryNotice,
  type ReplacePrompt,
  type SongLibraryStore,
} from './songLibrary/store.ts';
export {
  configureSongLibrary,
  type LibraryFiles,
  type SongLibraryRecords,
} from './songLibrary/runtime.ts';
export {
  analysisFailure,
  filterRows,
  inView,
  songBadge,
  summarize,
  type AnalysisFailure,
  type FailureKind,
  type LibrarySummary,
  type LibraryView,
  type SongBadge,
} from './songLibrary/logic.ts';
export type {
  BundleRefusal,
  BundleRefusalReason,
} from './songLibrary/stemBundleLogic.ts';
export { cleanName } from './names.ts';
export type {
  LibraryRow,
  LibrarySongRow,
  LibraryStemSetRow,
} from '@kitbag/core-db';
export { useSwipeHint } from './firstUse/useSwipeHint.ts';
export {
  configureSwipeHintPersistence,
  createSwipeHintStore,
  getSwipeHintStore,
  type SwipeHintPersistence,
  type SwipeHintStore,
} from './firstUse/store.ts';
export { useStemPlayer } from './stemPlayer/useStemPlayer.ts';
export { UNITY_GAIN } from './stemPlayer/mix.ts';
export {
  createStemPlayerStore,
  stemPlayerStore,
  type LoopFailure,
  type LoopState,
  type StemPlayerStatus,
  type StemPlayerStore,
  type StemRow,
} from './stemPlayer/store.ts';
export {
  configureStemPlayer,
  type SharedMetronome,
  type StemPlayerCommands,
  type StemPlayerEngine,
  type StemPlayerRecords,
  type StemPlayerRuntime,
} from './stemPlayer/runtime.ts';
export {
  formatClock,
  framesToSeconds,
  secondsToFrames,
} from './stemPlayer/time.ts';
export { SKIP_SECONDS } from './stemPlayer/songTransport.ts';
export {
  bpmFact,
  keyFact,
  shortKeyName,
  songFacts,
  type BpmFact,
  type SongFact,
  type SongFacts,
} from './stemPlayer/facts.ts';
export {
  clockParts,
  formatClockSeconds,
  MINUS,
  type ClockParts,
} from './text.ts';
export { CALIBRATION } from './rig/calibrationRules.ts';
export {
  analyseTaps,
  storedOffsetMs,
  type CalibrationOutcome,
} from './rig/calibrationStats.ts';
export {
  canUseOutcome,
  createCalibrationSession,
  type CalibrationDeps,
  type CalibrationNotice,
  type CalibrationPhase,
  type CalibrationSession,
} from './rig/calibrationSession.ts';
export { routeDetail, routeTitle } from './rig/routeLabel.ts';
export { formatOffsetMs } from './rig/latencyText.ts';
export {
  useCalibration,
  type CalibrationSessionStore,
} from './rig/useCalibration.ts';
