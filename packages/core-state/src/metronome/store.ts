// Metronome CONFIG store (SPEC §5.1–§5.3, §13.4). Human-speed only: the BPM
// target, time signature, accents, which trainer is on — values that change when
// a finger moves, not per frame. The 60fps truths (current_beat, bar_phase,
// current_bpm) are polled from the JSI HostObject by worklets (§13.3) and MUST
// NOT appear here; the store never keeps a copy of engine truth it believes over
// a poll. The store is INTENT — every mutation issues the matching engine
// command; the engine is TRUTH.

import {
  KB_ACCENT,
  KB_BPM_REFERENCE_DENOMINATOR,
  KB_DENOMINATORS,
  KB_LATENCY_OFFSET_MS_BOUNDS,
  KB_MAX_BEATS,
  KB_SOUND_NAMES,
  type KbDenominator,
} from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  defaultCommands,
  defaultNowFrame,
  type MetronomeCommands,
  type NowFrame,
} from './commands.ts';

// --- Bounds owned here (spec-level, not yet engine constants) -----------------
// BPM range is §5.2; the engine also clamps to its own range, but exposes no
// constant for it. Subdivision range is §5.1. The denominator set and the beat
// ceiling are engine-owned (§13.7) and arrive generated, never retyped here.
const BPM_MIN = 20;
const BPM_MAX = 400;

/** The §5.2 BPM range, exported so a screen (numpad range hint, clamp on
 * confirm) reads the store's bound instead of retyping it (§13.7). */
export const BPM_BOUNDS = { min: BPM_MIN, max: BPM_MAX } as const;
const SUBDIVISION_MIN = 1;
const BEATS_MIN = 1;
const SUBDIVISION_MAX = 16;

// Object-valued so the members carry meaning and stay off the magic-number rule.
const COUNT_IN_BARS = { off: 0, one: 1, two: 2, four: 4 } as const;

export type Denominator = KbDenominator;
export type CountInBars = (typeof COUNT_IN_BARS)[keyof typeof COUNT_IN_BARS];

const VALID_DENOMINATORS = new Set<number>(KB_DENOMINATORS);
const VALID_COUNT_IN_BARS = new Set<number>(Object.values(COUNT_IN_BARS));

export interface RampConfig {
  readonly enabled: boolean;
  readonly startBpm: number;
  readonly endBpm: number;
  readonly bars: number;
}

export interface BarMuteConfig {
  readonly enabled: boolean;
  readonly playBars: number;
  readonly muteBars: number;
}

// §5.3: a distinct sound per accent LEVEL (a tom on the accent, a block on the
// rest). The C ABI has only kb_metronome_set_sound (one global sound), so this
// is stored intent the engine cannot yet fully honour; setSound below sends the
// single sound the engine does take.
export interface PerAccentSounds {
  readonly normal: number;
  readonly accent: number;
}

export interface MetronomeConfig {
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly denominator: Denominator;
  readonly subdivision: number;
  readonly accents: readonly KB_ACCENT[];
  readonly perAccentSounds?: PerAccentSounds;
  readonly polyEnabled: boolean;
  readonly polyBeats: number;
  readonly sound: number;
  readonly volume: number;
  readonly latencyOffset: number;
  readonly ramp: RampConfig;
  readonly barMute: BarMuteConfig;
  readonly countInBars: CountInBars;
  readonly running: boolean;
  // §5.3: count-in fires on start only, "never after a pause mid-bar". This is
  // the only thing distinguishing pause from stop at this layer — the ABI has no
  // count-in command, so the future start screen reads this flag.
  readonly countInArmed: boolean;
}

export interface MetronomeActions {
  setTempo: (bpm: number) => void;
  setBeats: (beatsPerBar: number, denominator: number) => void;
  setSubdivision: (subdivision: number) => void;
  cycleAccent: (beat: number) => void;
  setPoly: (enabled: boolean, beats: number) => void;
  setSound: (soundIndex: number) => void;
  setPerAccentSounds: (sounds: PerAccentSounds) => void;
  setVolume: (volume: number) => void;
  setLatency: (latencyMs: number) => void;
  setRamp: (config: RampConfig) => void;
  setBarMute: (config: BarMuteConfig) => void;
  setCountIn: (bars: number) => void;
  start: () => void;
  stop: () => void;
  pause: () => void;
}

export type MetronomeStore = MetronomeConfig & MetronomeActions;

const DEFAULT_BPM = 120;
const DEFAULT_BEATS = 4;
// 4/4 default only coincides with the BPM reference note; revisit if that moves.
const DEFAULT_DENOMINATOR: Denominator = KB_BPM_REFERENCE_DENOMINATOR;
const DEFAULT_POLY_BEATS = 3;
const DEFAULT_VOLUME = 1;
// Trainer segment length in BARS — distinct from DEFAULT_BEATS (beats per bar)
// so a later change to the beats default cannot silently move these.
const DEFAULT_TRAINER_BARS = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// §5.2: tap a beat to cycle accent → normal → mute → accent.
function cycleAccentValue(accent: KB_ACCENT): KB_ACCENT {
  if (accent === KB_ACCENT.KB_ACCENT_ACCENTED)
    return KB_ACCENT.KB_ACCENT_NORMAL;
  if (accent === KB_ACCENT.KB_ACCENT_NORMAL) return KB_ACCENT.KB_ACCENT_MUTED;
  return KB_ACCENT.KB_ACCENT_ACCENTED;
}

// Preserves existing beats; new slots fill normal (no accent).
function resizeAccents(prev: readonly KB_ACCENT[], count: number): KB_ACCENT[] {
  return Array.from(
    { length: count },
    (_, i) => prev[i] ?? KB_ACCENT.KB_ACCENT_NORMAL,
  );
}

// Downbeat accented, rest normal (fresh bar).
function initialAccents(count: number): KB_ACCENT[] {
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? KB_ACCENT.KB_ACCENT_ACCENTED : KB_ACCENT.KB_ACCENT_NORMAL,
  );
}

/**
 * Build a metronome config store. Commands and the start-anchor clock are
 * injected so a test can spy the 1:1 command mapping and drive start() without a
 * native runtime; the default singleton wires the real core-native handles.
 */
export function createMetronomeStore(
  commands: MetronomeCommands = defaultCommands,
  nowFrame: NowFrame = defaultNowFrame,
): StoreApi<MetronomeStore> {
  return createStore<MetronomeStore>((set, get) => ({
    bpm: DEFAULT_BPM,
    beatsPerBar: DEFAULT_BEATS,
    denominator: DEFAULT_DENOMINATOR,
    subdivision: SUBDIVISION_MIN,
    accents: initialAccents(DEFAULT_BEATS),
    polyEnabled: false,
    polyBeats: DEFAULT_POLY_BEATS,
    sound: 0,
    volume: DEFAULT_VOLUME,
    latencyOffset: 0,
    ramp: {
      enabled: false,
      startBpm: DEFAULT_BPM,
      endBpm: DEFAULT_BPM,
      bars: DEFAULT_TRAINER_BARS,
    },
    barMute: {
      enabled: false,
      playBars: DEFAULT_TRAINER_BARS,
      muteBars: DEFAULT_TRAINER_BARS,
    },
    countInBars: COUNT_IN_BARS.off,
    running: false,
    countInArmed: true,

    setTempo: (bpm) => {
      const next = clamp(bpm, BPM_MIN, BPM_MAX);
      // §5.3: a manual tempo change cancels a running ramp; the engine does the
      // same on set_tempo, so the chip's enabled state must clear with it.
      set((s) => ({ bpm: next, ramp: { ...s.ramp, enabled: false } }));
      commands.setTempo(next);
    },

    setBeats: (beatsPerBar, denominator) => {
      if (!Number.isInteger(beatsPerBar) || beatsPerBar < BEATS_MIN) return;
      // Clamped to the engine's own ceiling: past it the engine plays
      // KB_MAX_BEATS while the store would still show what was asked for.
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
      // Same policy as setBeats, which this mirrors as a stepper: a count below
      // the floor is refused outright (a held − sends nothing rather than
      // re-sending the floor), and the engine's ceiling clamps.
      if (!Number.isInteger(beats) || beats < BEATS_MIN) return;
      const polyBeats = Math.min(beats, KB_MAX_BEATS);
      set({ polyEnabled: enabled, polyBeats });
      commands.setPoly(enabled, polyBeats);
    },

    setSound: (soundIndex) => {
      // Index into the engine-owned soundNames table (§13.7); ignore anything
      // out of range rather than mislabel a sound.
      if (soundIndex < 0 || soundIndex >= KB_SOUND_NAMES.length) return;
      set({ sound: soundIndex });
      commands.setSound(soundIndex);
    },

    setPerAccentSounds: (sounds) => {
      // Store-only intent: the ABI has one global kb_metronome_set_sound, no
      // per-accent-level voice. So this leaves the primary `sound` untouched
      // and issues no command; it only records the wish.
      set({ perAccentSounds: sounds });
    },

    setVolume: (volume) => {
      // No exported [0,2] bound to clamp against without inventing one (§13.7);
      // the engine owns and applies that clamp.
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

    setRamp: (config) => {
      set({ ramp: config });
      commands.setRamp(
        config.enabled,
        config.startBpm,
        config.endBpm,
        config.bars,
      );
    },

    setBarMute: (config) => {
      set({ barMute: config });
      commands.setBarMute(config.enabled, config.playBars, config.muteBars);
    },

    setCountIn: (bars) => {
      // Human-speed only: no ABI count-in command. Applied by the start screen.
      if (!VALID_COUNT_IN_BARS.has(bars)) return;
      set({ countInBars: bars as CountInBars });
    },

    start: () => {
      // Device open (async, fire-and-forget) then transport start at "now". The
      // anchor is a one-shot read of the engine clock, never held (§13.3).
      void commands.start();
      commands.metronomeStart(nowFrame());
      set({ running: true, countInArmed: false });
    },

    stop: () => {
      commands.metronomeStop();
      set({ running: false, countInArmed: true });
    },

    pause: () => {
      // Same engine call as stop; differs only in that count-in is NOT re-armed,
      // so a resume does not count in (§5.3).
      commands.metronomeStop();
      set({ running: false });
    },
  }));
}

/** Default singleton wired to the real core-native command + clock handles. */
export const metronomeStore = createMetronomeStore();
