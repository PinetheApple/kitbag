export { useMetronome } from './metronome/useMetronome.ts';
export {
  BPM_BOUNDS,
  DEFAULT_BPM,
  createMetronomeStore,
  metronomeStore,
  type MetronomeStore,
  type MetronomeConfig,
  type MetronomeActions,
  type RampConfig,
  type BarMuteConfig,
  type PerAccentSounds,
  type Denominator,
  type CountInBars,
} from './metronome/store.ts';
export type {
  EngineBpm,
  MetronomeCommands,
  NowFrame,
} from './metronome/commands.ts';
export {
  configureMetronomeRuntime,
  type MetronomeRuntime,
} from './metronome/runtime.ts';
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
export { accentsOf, byteList, toBlob } from './library/presetMapping.ts';
export type { Setlist, SetlistItem, SongPreset } from '@kitbag/core-db';
