import type { NewSongPreset, SongPreset } from '@kitbag/core-db';
import { KB_ACCENT, KB_RAMP_UNIT } from '@kitbag/core-native';

import {
  roundToEngineBpm,
  normalizeRamp,
  resizeAccents,
} from '../metronome/config.ts';
import { COUNT_IN_SCOPE, songCountIn } from '../metronome/countInScope.ts';
import { normalizePolyAgainst } from '../metronome/polyAgainst.ts';
import {
  applyMetronomeSettings,
  standaloneMetronomeOf,
  type MetronomeSettingsInput,
} from '../metronome/standalone.ts';
import type {
  CountInBars,
  MetronomeConfig,
  MetronomeStore,
  PerAccentSounds,
  RampConfig,
} from '../metronome/store.ts';

const ACCENTS = new Set<number>(Object.values(KB_ACCENT));

export type PresetFields = Omit<NewSongPreset, 'name' | 'id'>;

export function byteList(value: unknown): number[] {
  if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value));
  if (value instanceof Uint8Array || Array.isArray(value)) {
    return Array.from(value as ArrayLike<number>);
  }
  return [];
}

// Hermes has no Buffer global; op-sqlite binds a Uint8Array as a blob.
export function toBlob(values: readonly number[]): Buffer {
  return Uint8Array.from(values) as unknown as Buffer;
}

export function accentsOf(value: unknown): KB_ACCENT[] {
  return byteList(value).map((code) =>
    ACCENTS.has(code) ? (code as KB_ACCENT) : KB_ACCENT.KB_ACCENT_NORMAL,
  );
}

export function perAccentSoundsOf(
  value: unknown,
  fallback: number,
): PerAccentSounds {
  const saved = byteList(value);
  return {
    normal: saved[0] ?? fallback,
    accent: saved[1] ?? fallback,
  };
}

export function presetFromMetronome(config: MetronomeConfig) {
  return {
    bpm: config.bpm,
    beatsPerBar: config.beatsPerBar,
    denominator: config.denominator,
    subdivision: config.subdivision,
    accents: toBlob(config.accents),
    perAccentSounds: toBlob([config.sounds.normal, config.sounds.accent]),
    polyEnabled: config.polyEnabled,
    polyBeats: config.polyBeats,
    polyAgainst: config.polyAgainst,
    polyAccents: toBlob(config.polyAccents),
    sound: config.sounds.normal,
    rampEnabled: config.ramp.enabled,
    rampStartBpm: config.ramp.startBpm,
    rampEndBpm: config.ramp.targetBpm,
    rampStep: config.ramp.stepBpm,
    rampLength: config.ramp.interval,
    rampUnit: config.ramp.unit,
    rampLoop: config.ramp.loop,
    barMuteEnabled: config.barMute.enabled,
    barMutePlayBars: config.barMute.playBars,
    barMuteMuteBars: config.barMute.muteBars,
    countInBars: config.countIn.bars,
  } satisfies PresetFields;
}

export type LiveSongFields = ReturnType<typeof presetFromMetronome>;

export function songFieldsFromMetronome(
  config: MetronomeConfig,
): Partial<LiveSongFields> {
  const fields: Partial<LiveSongFields> = presetFromMetronome(config);
  if (config.countInScope === COUNT_IN_SCOPE.always) delete fields.countInBars;
  return fields;
}

const RAMP_UNITS = new Set<number>(Object.values(KB_RAMP_UNIT));

export function rampUnitOf(value: number): KB_RAMP_UNIT {
  return RAMP_UNITS.has(value)
    ? (value as KB_RAMP_UNIT)
    : KB_RAMP_UNIT.KB_RAMP_BARS;
}

function rampOf(preset: SongPreset, current: RampConfig): RampConfig {
  return {
    enabled: preset.rampEnabled,
    startBpm: preset.rampStartBpm ?? preset.bpm,
    targetBpm: preset.rampEndBpm ?? preset.bpm,
    stepBpm: preset.rampStep,
    interval: preset.rampLength ?? current.interval,
    unit: rampUnitOf(preset.rampUnit),
    loop: preset.rampLoop,
  };
}

interface SongSettings extends MetronomeSettingsInput {
  readonly countInBars: CountInBars;
}

function songSettingsOf(
  preset: SongPreset,
  current: MetronomeConfig,
): SongSettings {
  const ramp = rampOf(preset, current.ramp);
  return {
    bpm: roundToEngineBpm(preset.bpm),
    beatsPerBar: preset.beatsPerBar,
    denominator: preset.denominator,
    subdivision: preset.subdivision,
    accents: resizeAccents(accentsOf(preset.accents), preset.beatsPerBar),
    polyEnabled: preset.polyEnabled,
    polyBeats: preset.polyBeats,
    polyAgainst: normalizePolyAgainst(preset.polyAgainst, preset.beatsPerBar),
    polyAccents: resizeAccents(accentsOf(preset.polyAccents), preset.polyBeats),
    sounds: perAccentSoundsOf(preset.perAccentSounds, preset.sound),
    ramp: normalizeRamp(ramp) ?? ramp,
    barMute: {
      enabled: preset.barMuteEnabled,
      playBars: preset.barMutePlayBars ?? current.barMute.playBars,
      muteBars: preset.barMuteMuteBars ?? current.barMute.muteBars,
    },
    countInBars: songCountIn(
      current.countInScope,
      preset.countInBars,
      current.countIn,
    ).bars,
  };
}

function liveSettingsOf(config: MetronomeConfig): SongSettings {
  return {
    ...standaloneMetronomeOf(config),
    bpm: roundToEngineBpm(config.bpm),
    polyAgainst: normalizePolyAgainst(config.polyAgainst, config.beatsPerBar),
    countInBars: config.countIn.bars,
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) =>
    sameValue(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
}

// A running ramp moves the live tempo (syncTempoFromEngine), so it is no edit.
export function isLoadedSongUnsaved(
  preset: SongPreset,
  live: MetronomeConfig,
): boolean {
  const song = songSettingsOf(preset, live);
  const current = liveSettingsOf(live);
  const tempoDriven = live.ramp.enabled;
  return !sameValue(
    tempoDriven ? { ...song, bpm: current.bpm } : song,
    current,
  );
}

export function applyPreset(
  preset: SongPreset,
  metronome: () => MetronomeStore,
): void {
  const store = metronome();
  const song = songSettingsOf(preset, store);
  applyMetronomeSettings(store, { ...song, bpm: preset.bpm });
  if (store.countInScope === COUNT_IN_SCOPE.perSong)
    store.setCountIn({ ...store.countIn, bars: song.countInBars });
}
