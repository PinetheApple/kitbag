import type { NewSongPreset, SongPreset } from '@kitbag/core-db';
import { KB_ACCENT } from '@kitbag/core-native';

import type { MetronomeConfig, MetronomeStore } from '../metronome/store.ts';

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
function perAccentSoundsOf(
  value: unknown,
  fallback: number,
): { readonly normal: number; readonly accent: number } {
  const saved = byteList(value);
  return {
    normal: saved[0] ?? fallback,
    accent: saved[1] ?? fallback,
  };
}

export function presetFromMetronome(config: MetronomeConfig): PresetFields {
  return {
    bpm: config.bpm,
    beatsPerBar: config.beatsPerBar,
    denominator: config.denominator,
    subdivision: config.subdivision,
    accents: toBlob(config.accents),
    perAccentSounds: toBlob([
      config.perAccentSounds.normal,
      config.perAccentSounds.accent,
    ]),
    polyEnabled: config.polyEnabled,
    polyBeats: config.polyBeats,
    polyAccents: toBlob(config.polyAccents),
    sound: config.sound,
    rampEnabled: config.ramp.enabled,
    rampStartBpm: config.ramp.startBpm,
    rampEndBpm: config.ramp.endBpm,
    rampBars: config.ramp.bars,
    barMuteEnabled: config.barMute.enabled,
    barMutePlayBars: config.barMute.playBars,
    barMuteMuteBars: config.barMute.muteBars,
    countInBars: config.countInBars,
  };
}

function applyTrainers(preset: SongPreset, metronome: MetronomeStore): void {
  const { ramp, barMute } = metronome;
  metronome.setRamp({
    enabled: preset.rampEnabled,
    startBpm: preset.rampStartBpm ?? preset.bpm,
    endBpm: preset.rampEndBpm ?? preset.bpm,
    bars: preset.rampBars ?? ramp.bars,
  });
  metronome.setBarMute({
    enabled: preset.barMuteEnabled,
    playBars: preset.barMutePlayBars ?? barMute.playBars,
    muteBars: preset.barMuteMuteBars ?? barMute.muteBars,
  });
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
  store.setSound(preset.sound);
  store.setPerAccentSounds(
    perAccentSoundsOf(preset.perAccentSounds, preset.sound),
  );
  store.setCountIn(preset.countInBars);
  store.setTempo(preset.bpm);
  applyTrainers(preset, store);
}
