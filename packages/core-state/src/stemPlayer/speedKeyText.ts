import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';

import { MINUS } from '../text.ts';
import type { SongFacts } from './facts.ts';
import { UNSHIFTED_KEY } from './mix.ts';
import { SPEED_PRESETS, speedPercent } from './speedKey.ts';
import type { StemRow } from './store.ts';

const NEVER_TRANSPOSED = 'Drums and the click are never transposed.';
const NOT_TRANSPOSED = 'Drums and the click are not transposed.';

export const speedKeyCopy = {
  title: 'Speed and key',
  close: 'Close speed and key',
  speed: 'Speed',
  key: 'Key',
  songKey: 'Song key',
  perStem: 'Per-stem key',
  allFollow: 'all follow the song',
  follows: 'follows the song',
  setApart: 'set apart',
  notTransposed: 'not transposed',
  reset: 'Reset speed and key',
  noGrid: 'No beat grid, so there is no BPM to show',
} as const;

export type StemKeyRow = Pick<StemRow, 'name' | 'transposable' | 'key'>;

export interface SpeedPresetText {
  readonly value: number;
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly selected: boolean;
}

export function speedPercentText(speed: number): string {
  return `${String(speedPercent(speed))}%`;
}

export function speedPresetTexts(current: number): readonly SpeedPresetText[] {
  return SPEED_PRESETS.map((value) => ({
    value,
    label: speedPercentText(value),
    accessibilityLabel: `${speedKeyCopy.speed} ${speedPercentText(value)}`,
    selected: speedPercent(value) === speedPercent(current),
  }));
}

export function keyText(key: number): string {
  if (key === UNSHIFTED_KEY) return `${String(key)} st`;
  return `${key > 0 ? '+' : MINUS}${String(Math.abs(key))} st`;
}

export function resetValue(): string {
  return `${speedPercentText(KB_MIXER_UNITY_RATE)}, ${keyText(UNSHIFTED_KEY)}`;
}

export function speedHint(recorded: SongFacts, playing: SongFacts): string {
  const song = recorded.bpm?.value;
  const plays = playing.bpm?.value;
  if (song === undefined) return speedKeyCopy.noGrid;
  if (plays === undefined || plays === song) return `Song ${song} BPM`;
  return `Song ${song} BPM, plays at ${plays} BPM`;
}

export function keyHint(
  recorded: SongFacts,
  playing: SongFacts,
  songKey: number,
): string {
  const song = recorded.key?.text;
  if (songKey === UNSHIFTED_KEY)
    return song === undefined
      ? NEVER_TRANSPOSED
      : `${song}. ${NEVER_TRANSPOSED}`;
  const plays = playing.key?.text;
  if (song === undefined || plays === undefined) return NOT_TRANSPOSED;
  return `${song} plays as ${plays}. ${NOT_TRANSPOSED}`;
}

export function isSetApart(row: StemKeyRow, songKey: number): boolean {
  return row.transposable && row.key !== songKey;
}

export function stemKeyStatus(row: StemKeyRow, songKey: number): string {
  if (!row.transposable) return speedKeyCopy.notTransposed;
  return isSetApart(row, songKey)
    ? speedKeyCopy.setApart
    : speedKeyCopy.follows;
}
