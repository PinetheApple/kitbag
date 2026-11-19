import { countLabel } from '@kitbag/core-design';
import { KB_MIXDOWN_BITS_PER_SAMPLE } from '@kitbag/core-native';
import {
  megabytes,
  MINUS,
  roundedSpeed,
  UNSHIFTED_KEY,
  type ExportBlock,
  type ExportSummary,
} from '@kitbag/core-state';

const FORMAT = 'WAV';
const MIN_SPEED_DECIMALS = 1;
const KHZ_DECIMALS = 1;
const HZ_PER_KHZ = 1000;
const SHARE_SHEET_NOTE = 'The share sheet opens when it is done.';

export function exportBlockReason(
  block: Exclude<ExportBlock, 'running'>,
): string {
  switch (block) {
    case 'noStems':
      return 'no stems to mix';
    case 'allMuted':
      return 'every stem muted';
    case 'soloMuted':
      return 'soloed stems muted';
  }
}

export function exportRowValue(
  block: ExportBlock | null,
  percent: number,
): string {
  switch (block) {
    case null:
      return FORMAT;
    case 'running':
      return `exporting, ${String(percent)}%`;
    default:
      return exportBlockReason(block);
  }
}

export function speedLabel(speed: number): string {
  const rounded = roundedSpeed(speed);
  const text = Number.isInteger(rounded)
    ? rounded.toFixed(MIN_SPEED_DECIMALS)
    : String(rounded);
  return `${text}×`;
}

export function keyLabel(key: number | null): string {
  if (key === null) return 'Set per stem';
  if (key === UNSHIFTED_KEY) return 'As recorded';
  const sign = key > 0 ? '+' : MINUS;
  return `${sign}${countLabel(Math.abs(key), 'semitone', 'semitones')}`;
}

export function stemsLabel(summary: ExportSummary): string {
  const count = String(summary.stems);
  if (summary.soloed > 0) return `${count} · ${String(summary.soloed)} soloed`;
  if (summary.muted > 0) return `${count} · ${String(summary.muted)} muted`;
  return count;
}

export function rangeLabel(loopSet: boolean): string {
  return loopSet ? 'Whole song · loop not used' : 'Whole song';
}

export function formatLabel(sampleRate: number): string {
  const khz = Number((sampleRate / HZ_PER_KHZ).toFixed(KHZ_DECIMALS));
  return `${FORMAT} · ${String(KB_MIXDOWN_BITS_PER_SAMPLE)}-bit · ${String(khz)} kHz`;
}

export function sizeLabel(bytes: number): string {
  return `about ${megabytes(bytes)}`;
}

export function runningBody(otherSong: string | null): string {
  if (otherSong === null)
    return `Keep playing if you like; this does not change the file. ${SHARE_SHEET_NOTE}`;
  return `Exporting “${otherSong}”. ${SHARE_SHEET_NOTE}`;
}
