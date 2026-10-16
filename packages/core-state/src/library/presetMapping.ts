import type { NewSongPreset, SongPreset } from '@kitbag/core-db';
import { KB_ACCENT, KB_RAMP_UNIT } from '@kitbag/core-native';

import { isCountInBars } from '../metronome/config.ts';
import type {
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

function perAccentSoundsOf(value: unknown, fallback: number): PerAccentSounds {
  const saved = byteList(value);
  return {
    normal: saved[0] ?? fallback,
    accent: saved[1] ?? fallback,
  };
}

export function presetFromMetronome(config: MetronomeConfig): PresetFields {
  // The schema stores ramps in bars only; a time-based ramp cannot round-trip.
  const barRamp = config.ramp.unit === KB_RAMP_UNIT.KB_RAMP_BARS;
  return {
    bpm: config.bpm,
    beatsPerBar: config.beatsPerBar,
    denominator: config.denominator,
    subdivision: config.subdivision,
    accents: toBlob(config.accents),
    perAccentSounds: toBlob([config.sounds.normal, config.sounds.accent]),
    polyEnabled: config.polyEnabled,
    polyBeats: config.polyBeats,
    polyAccents: toBlob(config.polyAccents),
    sound: config.sounds.normal,
    rampEnabled: barRamp && config.ramp.enabled,
    rampStartBpm: config.ramp.startBpm,
    rampEndBpm: config.ramp.endBpm,
    rampBars: barRamp ? config.ramp.duration : null,
    barMuteEnabled: config.barMute.enabled,
    barMutePlayBars: config.barMute.playBars,
    barMuteMuteBars: config.barMute.muteBars,
    countInBars: config.countIn.bars,
  };
}

function rampOf(preset: SongPreset, current: RampConfig): RampConfig {
  return {
    enabled: preset.rampEnabled,
    startBpm: preset.rampStartBpm ?? preset.bpm,
    endBpm: preset.rampEndBpm ?? preset.bpm,
    duration: preset.rampBars ?? current.duration,
    unit: KB_RAMP_UNIT.KB_RAMP_BARS,
    loop: false,
  };
}

// setTempo switches a ramp off, and switching one off re-reads the engine's
// tempo, which is stale until the engine catches up; so order by ramp state.
function applyTempo(preset: SongPreset, store: MetronomeStore): void {
  const ramp = rampOf(preset, store.ramp);
  if (ramp.enabled) {
    store.setTempo(preset.bpm);
    store.setRamp(ramp);
    return;
  }
  store.setRamp(ramp);
  store.setTempo(preset.bpm);
}

export function applyPreset(
  preset: SongPreset,
  metronome: () => MetronomeStore,
): void {
  const store = metronome();
  store.setBeats(preset.beatsPerBar, preset.denominator);
  store.setAccents(accentsOf(preset.accents));
  store.setSubdivision(preset.subdivision);
  store.setPoly(preset.polyEnabled, preset.polyBeats);
  store.setPolyAccents(accentsOf(preset.polyAccents));
  const sounds = perAccentSoundsOf(preset.perAccentSounds, preset.sound);
  store.setSounds(sounds.normal, sounds.accent);
  if (isCountInBars(preset.countInBars)) {
    store.setCountIn({ ...store.countIn, bars: preset.countInBars });
  }
  store.setBarMute({
    enabled: preset.barMuteEnabled,
    playBars: preset.barMutePlayBars ?? store.barMute.playBars,
    muteBars: preset.barMuteMuteBars ?? store.barMute.muteBars,
  });
  applyTempo(preset, store);
}
