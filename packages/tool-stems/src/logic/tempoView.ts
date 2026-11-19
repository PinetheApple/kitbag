import type { SegmentOption } from '@kitbag/core-design';
import {
  BPM_UNIT,
  canBuildTempoMode,
  TEMPO_MODE,
  type BundleTempo,
  type TempoMode,
} from '@kitbag/core-state';

const MODE_LABEL: Readonly<Record<TempoMode, string>> = {
  [TEMPO_MODE.constant]: 'Constant tempo',
  [TEMPO_MODE.follow]: 'Follow the band',
};

export const tempoCopy = {
  row: 'Tempo',
  title: 'Tempo',
  close: 'Close the tempo sheet',
  grid: 'Beat grid',
  done: 'Done',
  noTempo: 'Re-export from StemDeck to switch tempo.',
  noFit: 'StemDeck found no steady tempo in this song.',
  constantOnly: `Exported from StemDeck at a constant tempo. Export it in ${MODE_LABEL[TEMPO_MODE.follow]} to switch.`,
} as const;

const BPM_DECIMALS = 1;

const MODE_HINT: Readonly<Record<TempoMode, string>> = {
  [TEMPO_MODE.constant]:
    'One tempo for the whole song. The click and loop snapping hold steady.',
  [TEMPO_MODE.follow]:
    'The beats StemDeck heard. The click and loop snapping speed up and slow down with the band.',
};

const MODE_ORDER: readonly TempoMode[] = [
  TEMPO_MODE.constant,
  TEMPO_MODE.follow,
];

export const tempoModeLabel = (mode: TempoMode) => MODE_LABEL[mode];

export function tempoUnavailable(tempo: BundleTempo | null): string | null {
  return tempo === null ? tempoCopy.noTempo : null;
}

export function tempoOptions(
  tempo: BundleTempo | null,
): readonly SegmentOption<TempoMode>[] {
  return MODE_ORDER.map((mode) => ({
    value: mode,
    label: MODE_LABEL[mode],
    ...(canBuildTempoMode(tempo, mode) ? {} : { disabled: true }),
  }));
}

export function constantLine(tempo: BundleTempo | null): string | null {
  if (tempo === null) return null;
  const { bpm } = tempo;
  if (bpm === null || !canBuildTempoMode(tempo, TEMPO_MODE.constant))
    return tempoCopy.noFit;
  return `Constant: ${bpm.toFixed(BPM_DECIMALS)} ${BPM_UNIT}`;
}

export function tempoHint(tempo: BundleTempo, mode: TempoMode): string {
  return canBuildTempoMode(tempo, TEMPO_MODE.follow)
    ? MODE_HINT[mode]
    : tempoCopy.constantOnly;
}
