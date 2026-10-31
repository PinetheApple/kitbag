import {
  KB_ACCENT,
  KB_BPM_REFERENCE_DENOMINATOR,
  KB_COUNT_IN_OFF,
  KB_DEFAULT_SOUNDS,
  KB_DEFAULT_COUNT_IN_SOUND,
  KB_LATENCY_OFFSET_MS_BOUNDS,
  KB_MUTE_BARS_BOUNDS,
  KB_POLY_AGAINST_BAR,
  KB_RAMP_UNIT,
  KB_SUBDIVISION_BOUNDS,
  KB_VOLUME_BOUNDS,
  acquireEngineHold,
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
  initialAccents,
  isCountInBars,
  isSoundId,
  normalizeRamp,
  type CountInConfig,
  type PerAccentSounds,
  type RampConfig,
} from './config.ts';
import { patternActions } from './patternActions.ts';
import {
  IDLE_PRACTICE,
  practiceAfterRunning,
  resetPracticeClock,
  type PracticeClock,
} from './practice.ts';

export {
  BPM_BOUNDS,
  type CountInConfig,
  type PerAccentSounds,
  type RampConfig,
} from './config.ts';

export type Denominator = KbDenominator;
export type CountInBars = KbCountInBars;

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
  readonly polyAgainst: number;
  readonly polyAccents: readonly KB_ACCENT[];
  readonly sounds: PerAccentSounds;
  readonly volume: number;
  readonly latencyOffset: number;
  readonly ramp: RampConfig;
  readonly barMute: BarMuteConfig;
  readonly countIn: CountInConfig;
  readonly running: boolean;
  readonly practice: PracticeClock;
}

export interface MetronomeActions {
  setTempo: (bpm: number) => void;
  nudgeTempo: (delta: number) => void;
  resetPractice: () => void;
  syncTempoFromEngine: () => void;
  setBeats: (beatsPerBar: number, denominator: number) => void;
  setSubdivision: (subdivision: number) => void;
  cycleAccent: (beat: number) => void;
  setAccents: (accents: readonly KB_ACCENT[]) => void;
  setPoly: (enabled: boolean, beats: number) => void;
  setPolyAgainst: (against: number) => void;
  stepPolyAgainst: (delta: number) => void;
  cyclePolyAccent: (beat: number) => void;
  setPolyAccents: (accents: readonly KB_ACCENT[]) => void;
  setSounds: (normal: number, accent: number) => void;
  previewSound: (sound: number, accented: boolean) => void;
  holdEngine: () => () => void;
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
const DEFAULT_DENOMINATOR: Denominator = KB_BPM_REFERENCE_DENOMINATOR;
export const DEFAULT_POLY_BEATS = 3;
const DEFAULT_VOLUME = 1;
export const DEFAULT_TRAINER_BARS = 4;
export const DEFAULT_RAMP_STEP_BPM = 5;

function initialConfig(): MetronomeConfig {
  return {
    bpm: DEFAULT_BPM,
    beatsPerBar: DEFAULT_BEATS,
    denominator: DEFAULT_DENOMINATOR,
    subdivision: KB_SUBDIVISION_BOUNDS.min,
    accents: initialAccents(DEFAULT_BEATS),
    polyEnabled: false,
    polyBeats: DEFAULT_POLY_BEATS,
    polyAgainst: KB_POLY_AGAINST_BAR,
    polyAccents: initialAccents(DEFAULT_POLY_BEATS),
    sounds: { ...KB_DEFAULT_SOUNDS },
    volume: DEFAULT_VOLUME,
    latencyOffset: 0,
    ramp: {
      enabled: false,
      startBpm: DEFAULT_BPM,
      targetBpm: DEFAULT_BPM,
      stepBpm: DEFAULT_RAMP_STEP_BPM,
      interval: DEFAULT_TRAINER_BARS,
      unit: KB_RAMP_UNIT.KB_RAMP_BARS,
      loop: false,
    },
    barMute: {
      enabled: false,
      playBars: DEFAULT_TRAINER_BARS,
      muteBars: DEFAULT_TRAINER_BARS,
    },
    countIn: {
      bars: KB_COUNT_IN_OFF,
      distinct: true,
      sound: KB_DEFAULT_COUNT_IN_SOUND,
    },
    running: false,
    practice: IDLE_PRACTICE,
  };
}

type Set = StoreApi<MetronomeStore>['setState'];
type Get = StoreApi<MetronomeStore>['getState'];

// Commands queue until the device opens, so a stopped engine's tempo is stale.
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

function soundActions(
  set: Set,
  get: Get,
  commands: MetronomeCommands,
  engineHeld: () => boolean,
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
      if (!isSoundId(sound) || !engineHeld()) return;
      commands.previewSound(sound, accented);
    },

    setVolume: (volume) => {
      const next = clamp(volume, KB_VOLUME_BOUNDS.min, KB_VOLUME_BOUNDS.max);
      set({ volume: next });
      commands.setVolume(next);
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
      // The engine jumps to the start tempo when it arms a ramp (ArmRamp).
      set(ramp.enabled ? { ramp, bpm: ramp.startBpm } : { ramp });
      commands.setRamp(
        ramp.enabled,
        ramp.startBpm,
        ramp.targetBpm,
        ramp.stepBpm,
        ramp.interval,
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
      const barMute = {
        enabled: config.enabled,
        playBars: clamp(
          config.playBars,
          KB_MUTE_BARS_BOUNDS.min,
          KB_MUTE_BARS_BOUNDS.max,
        ),
        muteBars: clamp(
          config.muteBars,
          KB_MUTE_BARS_BOUNDS.min,
          KB_MUTE_BARS_BOUNDS.max,
        ),
      };
      set({ barMute });
      commands.setBarMute(barMute.enabled, barMute.playBars, barMute.muteBars);
    },

    start: () => {
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

export function createMetronomeStore(
  commands: MetronomeCommands = defaultCommands,
  nowFrame: NowFrame = defaultNowFrame,
  engineBpm: EngineBpm = defaultEngineBpm,
  now: () => number = Date.now,
): StoreApi<MetronomeStore> {
  let holds = 0;
  const store = createStore<MetronomeStore>((set, get) => {
    const tempo = engineTempoOf(set, get, engineBpm);
    return {
      ...initialConfig(),
      ...patternActions(set, get, commands),
      ...soundActions(set, get, commands, () => holds > 0),
      ...tempoActions(set, get, commands, tempo),
      ...transportActions(set, commands, nowFrame, tempo),
      holdEngine: () => {
        const release = acquireEngineHold(commands);
        let held = true;
        holds++;
        return () => {
          if (!held) return;
          held = false;
          holds--;
          release();
        };
      },
      resetPractice: () => {
        set((s) => ({ practice: resetPracticeClock(s.practice, now()) }));
      },
    };
  });
  // Every way playback starts or stops, including the notification, goes through running.
  store.subscribe((state, previous) => {
    if (state.running === previous.running) return;
    store.setState({
      practice: practiceAfterRunning(state.practice, state.running, now()),
    });
  });
  return store;
}

export const metronomeStore = createMetronomeStore();
