import { countLabel } from '@kitbag/core-design';
import {
  MINUS,
  speedPercent,
  UNSHIFTED_KEY,
  type SongFacts,
  type StemRow,
} from '@kitbag/core-state';
import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';

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

export function speedText(speed: number): string {
  return `${String(speedPercent(speed))}%`;
}

export function keyText(key: number): string {
  if (key === UNSHIFTED_KEY) return `${String(key)} st`;
  return `${key > 0 ? '+' : MINUS}${String(Math.abs(key))} st`;
}

export function spokenKey(key: number): string {
  const steps = countLabel(Math.abs(key), 'semitone', 'semitones');
  if (key === UNSHIFTED_KEY) return 'as recorded';
  return key > 0 ? `up ${steps}` : `down ${steps}`;
}

export function resetValue(): string {
  return `${speedText(KB_MIXER_UNITY_RATE)}, ${keyText(UNSHIFTED_KEY)}`;
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

export function perStemSummary(
  rows: readonly StemKeyRow[],
  songKey: number,
): string {
  const apart = rows.filter((row) => isSetApart(row, songKey));
  const [only] = apart;
  if (only === undefined) return speedKeyCopy.allFollow;
  const who =
    apart.length === 1 ? only.name : countLabel(apart.length, 'stem', 'stems');
  return `${who} ${speedKeyCopy.setApart}`;
}
