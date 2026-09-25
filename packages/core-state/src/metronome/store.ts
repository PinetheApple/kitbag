// Human-speed intent only (SPEC §13.4): every mutation sends its engine
// command, and 60fps truths are polled from the HostObject, never kept here.

import {
  KB_ACCENT,
  KB_BPM_REFERENCE_DENOMINATOR,
  KB_DEFAULT_COUNT_IN_SOUND,
  KB_DENOMINATORS,
  KB_LATENCY_OFFSET_MS_BOUNDS,
  KB_MAX_BEATS,
  KB_POLY_BEATS_BOUNDS,
  KB_RAMP_UNIT,
  type KbCountInBars,
  type KbDenominator,
} from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  defaultCommands,
  defaultEngineBpm,
  defaultNowFrame,
  type EngineBpm,
  type MetronomeCommands,
  type NowFrame,
} from './commands.ts';
import {
  BPM_BOUNDS,
  clamp,
  cycleAccentValue,
  initialAccents,
  isCountInBars,
  isSoundId,
  normalizeRamp,
  resizeAccents,
  type CountInConfig,
  type PerAccentSounds,
  type RampConfig,
} from './config.ts';

export {
  BPM_BOUNDS,
  type CountInConfig,
  type PerAccentSounds,
  type RampConfig,
} from './config.ts';

const SUBDIVISION_MIN = 1;
const SUBDIVISION_MAX = 16;
const BEATS_MIN = 1;

export type Denominator = KbDenominator;
export type CountInBars = KbCountInBars;

const VALID_DENOMINATORS = new Set<number>(KB_DENOMINATORS);

export interface BarMuteConfig {
  readonly enabled: boolean;
  readonly playBars: number;
  readonly muteBars: number;
}

export interface MetronomeConfig {
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly denominator: Denominator;
  readonly subdivision: number;
  readonly accents: readonly KB_ACCENT[];
  readonly polyEnabled: boolean;
  readonly polyBeats: number;
  readonly polyAccents: readonly KB_ACCENT[];
  readonly sounds: PerAccentSounds;
  readonly volume: number;
  readonly latencyOffset: number;
  readonly ramp: RampConfig;
  readonly barMute: BarMuteConfig;
  readonly countIn: CountInConfig;
  readonly running: boolean;
}

export interface MetronomeActions {
  setTempo: (bpm: number) => void;
  nudgeTempo: (delta: number) => void;
  syncTempoFromEngine: () => void;
  setBeats: (beatsPerBar: number, denominator: number) => void;
  setSubdivision: (subdivision: number) => void;
  cycleAccent: (beat: number) => void;
  setPoly: (enabled: boolean, beats: number) => void;
  cyclePolyAccent: (beat: number) => void;
  setSounds: (normal: number, accent: number) => void;
  previewSound: (sound: number, accented: boolean) => void;
  setVolume: (volume: number) => void;
  setLatency: (latencyMs: number) => void;
  setRamp: (config: RampConfig) => void;
  setBarMute: (config: BarMuteConfig) => void;
  setCountIn: (config: CountInConfig) => void;
  start: () => void;
  stop: () => void;
  pause: () => void;
}

export type MetronomeStore = MetronomeConfig & MetronomeActions;

export const DEFAULT_BPM = 120;
const DEFAULT_BEATS = 4;
// 4/4 default only coincides with the BPM reference note; revisit if that moves.
const DEFAULT_DENOMINATOR: Denominator = KB_BPM_REFERENCE_DENOMINATOR;
const DEFAULT_POLY_BEATS = 3;
const DEFAULT_VOLUME = 1;
const DEFAULT_TRAINER_BARS = 4;

function initialConfig(): MetronomeConfig {
  return {
    bpm: DEFAULT_BPM,
    beatsPerBar: DEFAULT_BEATS,
    denominator: DEFAULT_DENOMINATOR,
    subdivision: SUBDIVISION_MIN,
    accents: initialAccents(DEFAULT_BEATS),
    polyEnabled: false,
    polyBeats: DEFAULT_POLY_BEATS,
    polyAccents: initialAccents(DEFAULT_POLY_BEATS),
    sounds: { normal: 0, accent: 0 },
    volume: DEFAULT_VOLUME,
    latencyOffset: 0,
    ramp: {
      enabled: false,
      startBpm: DEFAULT_BPM,
      endBpm: DEFAULT_BPM,
      duration: DEFAULT_TRAINER_BARS,
      unit: KB_RAMP_UNIT.KB_RAMP_BARS,
      loop: false,
    },
    barMute: {
      enabled: false,
      playBars: DEFAULT_TRAINER_BARS,
      muteBars: DEFAULT_TRAINER_BARS,
    },
    countIn: { bars: 0, distinct: true, sound: KB_DEFAULT_COUNT_IN_SOUND },
    running: false,
  };
}

type Set = StoreApi<MetronomeStore>['setState'];
type Get = StoreApi<MetronomeStore>['getState'];

// Commands queue until the device opens on start, so a stopped engine's tempo
// is stale; so is a JS-only run with no HostObject.
function readEngineTempo(engineBpm: EngineBpm, fallback: number): number {
  let bpm: number;
  try {
    bpm = engineBpm();
  } catch {
    return fallback;
  }
  return Number.isFinite(bpm)
    ? clamp(Math.round(bpm), BPM_BOUNDS.min, BPM_BOUNDS.max)
    : fallback;
}

interface EngineTempo {
  readonly read: () => number;
  readonly sync: () => void;
}

function engineTempoOf(set: Set, get: Get, engineBpm: EngineBpm): EngineTempo {
  const read = (): number => {
    const state = get();
    return state.running ? readEngineTempo(engineBpm, state.bpm) : state.bpm;
  };
  return {
    read,
    sync: () => {
      set({ bpm: read() });
    },
  };
}

function patternActions(
  set: Set,
  get: Get,
  commands: MetronomeCommands,
): Pick<
  MetronomeActions,
  'setBeats' | 'setSubdivision' | 'cycleAccent' | 'setPoly' | 'cyclePolyAccent'
> {
  return {
    setBeats: (beatsPerBar, denominator) => {
      if (!Number.isInteger(beatsPerBar) || beatsPerBar < BEATS_MIN) return;
      const beats = Math.min(beatsPerBar, KB_MAX_BEATS);
      const denom: Denominator = VALID_DENOMINATORS.has(denominator)
        ? (denominator as Denominator)
        : get().denominator;
      set((s) => ({
        beatsPerBar: beats,
        denominator: denom,
        accents: resizeAccents(s.accents, beats),
      }));
      commands.setBeats(beats, denom);
    },

    setSubdivision: (subdivision) => {
      const next = clamp(
        Math.trunc(subdivision),
        SUBDIVISION_MIN,
        SUBDIVISION_MAX,
      );
      set({ subdivision: next });
      commands.setSubdivision(next);
    },

    cycleAccent: (beat) => {
      const current = get().accents[beat];
      if (current === undefined) return;
      const next = cycleAccentValue(current);
      set((s) => ({
        accents: s.accents.map((a, i) => (i === beat ? next : a)),
      }));
      commands.setAccent(beat, next);
    },

    setPoly: (enabled, beats) => {
      if (!Number.isInteger(beats) || beats < KB_POLY_BEATS_BOUNDS.min) return;
      const polyBeats = Math.min(beats, KB_POLY_BEATS_BOUNDS.max);
      set((s) => ({
        polyEnabled: enabled,
        polyBeats,
        polyAccents: resizeAccents(s.polyAccents, polyBeats),
      }));
      commands.setPoly(enabled, polyBeats);
    },

    cyclePolyAccent: (beat) => {
      const current = get().polyAccents[beat];
      if (current === undefined) return;
      const next = cycleAccentValue(current);
      set((s) => ({
        polyAccents: s.polyAccents.map((a, i) => (i === beat ? next : a)),
      }));
      commands.setPolyAccent(beat, next);
    },
  };
}

function soundActions(
  set: Set,
  get: Get,
  commands: MetronomeCommands,
): Pick<
  MetronomeActions,
  'setSounds' | 'previewSound' | 'setVolume' | 'setLatency' | 'setCountIn'
> {
  return {
    setSounds: (normal, accent) => {
      if (!isSoundId(normal) && !isSoundId(accent)) return;
      const prev = get().sounds;
      const sounds = {
        normal: isSoundId(normal) ? normal : prev.normal,
        accent: isSoundId(accent) ? accent : prev.accent,
      };
      set({ sounds });
      commands.setSounds(sounds.normal, sounds.accent);
    },

    previewSound: (sound, accented) => {
      if (!isSoundId(sound)) return;
      commands.previewSound(sound, accented);
    },

    setVolume: (volume) => {
      set({ volume });
      commands.setVolume(volume);
    },

    setLatency: (latencyMs) => {
      const next = clamp(
        latencyMs,
        KB_LATENCY_OFFSET_MS_BOUNDS.min,
        KB_LATENCY_OFFSET_MS_BOUNDS.max,
      );
      set({ latencyOffset: next });
      commands.setLatencyOffset(next);
    },

    setCountIn: (config) => {
      const prev = get().countIn;
      const countIn: CountInConfig = {
        bars: isCountInBars(config.bars) ? config.bars : prev.bars,
        distinct: config.distinct,
        sound: isSoundId(config.sound) ? config.sound : prev.sound,
      };
      set({ countIn });
      commands.setCountIn(countIn.bars, countIn.distinct, countIn.sound);
    },
  };
}

function tempoActions(
  set: Set,
  get: Get,
  commands: MetronomeCommands,
  tempo: EngineTempo,
): Pick<
  MetronomeActions,
  'setTempo' | 'nudgeTempo' | 'syncTempoFromEngine' | 'setRamp'
> {
  return {
    setTempo: (bpm) => {
      const next = clamp(bpm, BPM_BOUNDS.min, BPM_BOUNDS.max);
      // The engine cancels a running ramp on set_tempo; the chip clears with it.
      set((s) => ({ bpm: next, ramp: { ...s.ramp, enabled: false } }));
      commands.setTempo(next);
    },

    nudgeTempo: (delta) => {
      get().setTempo(tempo.read() + delta);
    },

    syncTempoFromEngine: tempo.sync,

    setRamp: (config) => {
      const ramp = normalizeRamp(config);
      if (ramp === undefined) return;
      set({ ramp });
      commands.setRamp(
        ramp.enabled,
        ramp.startBpm,
        ramp.endBpm,
        ramp.duration,
        ramp.unit,
        ramp.loop,
      );
      if (!ramp.enabled) tempo.sync();
    },
  };
}

function transportActions(
  set: Set,
  commands: MetronomeCommands,
  nowFrame: NowFrame,
  tempo: EngineTempo,
): Pick<MetronomeActions, 'setBarMute' | 'start' | 'stop' | 'pause'> {
  return {
    setBarMute: (config) => {
      set({ barMute: config });
      commands.setBarMute(config.enabled, config.playBars, config.muteBars);
    },

    start: () => {
      void commands.start();
      commands.metronomeStart(nowFrame());
      set({ running: true });
    },

    stop: () => {
      tempo.sync();
      commands.metronomeStop();
      set({ running: false });
    },

    pause: () => {
      tempo.sync();
      commands.metronomePause();
      set({ running: false });
    },
  };
}

/** Commands and the clock are injected so tests spy the command mapping. */
export function createMetronomeStore(
  commands: MetronomeCommands = defaultCommands,
  nowFrame: NowFrame = defaultNowFrame,
  engineBpm: EngineBpm = defaultEngineBpm,
): StoreApi<MetronomeStore> {
  return createStore<MetronomeStore>((set, get) => {
    const tempo = engineTempoOf(set, get, engineBpm);
    return {
      ...initialConfig(),
      ...patternActions(set, get, commands),
      ...soundActions(set, get, commands),
      ...tempoActions(set, get, commands, tempo),
      ...transportActions(set, commands, nowFrame, tempo),
    };
  });
}

export const metronomeStore = createMetronomeStore();
