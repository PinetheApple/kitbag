import { countLabel } from '@kitbag/core-design';
import { KB_COUNT_IN_OFF } from '@kitbag/core-native';
import type { SongPreset } from '@kitbag/core-state';

import { countInLabel, countInBarsFromOption } from './countIn.ts';
import { soundLabel } from './soundChoice.ts';
import { TEXT_PLACEHOLDER } from './textPlaceholder.ts';
import { rampChipValue } from './trainer.ts';

function modifier(preset: SongPreset): string {
  if (preset.rampEnabled) {
    return `ramp ${rampChipValue(preset.rampStartBpm ?? preset.bpm, preset.rampEndBpm ?? preset.bpm)}`;
  }
  if ((preset.notes ?? '') !== '') return 'notes';
  const countIn = countInBarsFromOption(String(preset.countInBars));
  if (countIn !== KB_COUNT_IN_OFF) {
    return `count-in ${countInLabel(countIn)}`;
  }
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
  const songs = countLabel(songCount, 'song', 'songs');
  if (played !== undefined)
    return `${songs} · ${String(played)} played tonight`;
  if (rampCount > 0) return `${songs} · ramp on ${String(rampCount)}`;
  return songs;
}

export function setlistTitle(name: string | undefined): string {
  return name ?? TEXT_PLACEHOLDER;
}
