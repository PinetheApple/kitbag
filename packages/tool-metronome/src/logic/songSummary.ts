import { countLabel, TEXT_PLACEHOLDER } from '@kitbag/core-design';
import { KB_COUNT_IN_OFF } from '@kitbag/core-native';
import {
  soundLabel,
  type CustomSoundView,
  type SongPreset,
  countInBarsFromOption,
} from '@kitbag/core-state';

import { countInLabel } from './countIn.ts';
import { rampChipValue } from './trainer.ts';

function modifier(
  preset: SongPreset,
  custom: readonly CustomSoundView[],
): string {
  const rampStart = preset.rampStartBpm ?? preset.bpm;
  const rampEnd = preset.rampEndBpm ?? preset.bpm;
  if (preset.rampEnabled && rampStart !== null && rampEnd !== null) {
    return `ramp ${rampChipValue(rampStart, rampEnd)}`;
  }
  if ((preset.notes ?? '') !== '') return 'notes';
  const countIn = countInBarsFromOption(String(preset.countInBars));
  if (countIn !== KB_COUNT_IN_OFF) {
    return `count-in ${countInLabel(countIn)}`;
  }
  return soundLabel(preset.sound, custom);
}

export function songSubtitle(
  preset: SongPreset,
  custom: readonly CustomSoundView[] = [],
): string {
  const signature = `${String(preset.beatsPerBar)}/${String(preset.denominator)}`;
  const tempo = preset.bpm === null ? [] : [String(Math.round(preset.bpm))];
  return [...tempo, signature, modifier(preset, custom)].join(' · ');
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
