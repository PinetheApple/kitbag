import { countLabel } from '@kitbag/core-design';
import {
  isSetApart,
  speedKeyCopy,
  UNSHIFTED_KEY,
  type StemKeyRow,
} from '@kitbag/core-state';

export function spokenKey(key: number): string {
  const steps = countLabel(Math.abs(key), 'semitone', 'semitones');
  if (key === UNSHIFTED_KEY) return 'as recorded';
  return key > 0 ? `up ${steps}` : `down ${steps}`;
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
