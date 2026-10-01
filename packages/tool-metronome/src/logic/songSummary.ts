import { KB_SOUND_NAMES } from '@kitbag/core-native';
import type { SongPreset } from '@kitbag/core-state';

import { rampChipValue } from './trainer.ts';

export function soundLabel(sound: number): string {
  const name = KB_SOUND_NAMES[sound] ?? '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function bars(count: number): string {
  return `${String(count)} ${count === 1 ? 'bar' : 'bars'}`;
}

function modifier(preset: SongPreset): string {
  if (preset.rampEnabled) {
    return `⛰ ${rampChipValue(preset.rampStartBpm ?? preset.bpm, preset.rampEndBpm ?? preset.bpm)}`;
  }
  if ((preset.notes ?? '') !== '') return '✎ notes';
  if (preset.countInBars > 0) return `⏱ ${bars(preset.countInBars)}`;
  return soundLabel(preset.sound);
}

export function songSubtitle(preset: SongPreset): string {
  const signature = `${String(preset.beatsPerBar)}/${String(preset.denominator)}`;
  return `${String(Math.round(preset.bpm))} · ${signature} · ${modifier(preset)}`;
}

export function setlistSubtitle(
  songCount: number,
  rampCount: number,
  played: number | undefined,
): string {
  const songs = `${String(songCount)} ${songCount === 1 ? 'song' : 'songs'}`;
  if (played !== undefined)
    return `${songs} · ${String(played)} played tonight`;
  if (rampCount > 0) return `${songs} · ramp on ${String(rampCount)}`;
  return songs;
}
