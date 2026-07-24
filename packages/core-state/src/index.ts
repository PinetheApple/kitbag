// core-state — Zustand stores and the concrete DI layer (SPEC §13.1, §13.4).
// May import core-native, core-db, core-plugin-api. This is the ONE package
// that holds stores; realtime values are NOT in the store (§13.3), and the
// store never keeps a shadow copy of engine truth it believes over a poll.

export {
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
export type { MetronomeCommands, NowFrame } from './metronome/commands.ts';
