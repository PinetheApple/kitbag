import {
  canBuildTempoMode,
  TEMPO_MODE,
  TEMPO_SOURCE,
  type BundleTempo,
  type LibraryRow,
  type TempoMode,
  type TempoSource,
} from '@kitbag/core-db';

import { BPM_UNIT } from './facts.ts';

const MODE_LABEL: Readonly<Record<TempoMode, string>> = {
  [TEMPO_MODE.constant]: 'Constant tempo',
  [TEMPO_MODE.follow]: 'Follow the band',
};

const FINDER: Readonly<Record<TempoSource, string>> = {
  [TEMPO_SOURCE.detected]: 'StemDeck',
  [TEMPO_SOURCE.user]: 'StemDeck',
  [TEMPO_SOURCE.analysed]: 'Kitbag',
};

export const tempoText = {
  noTempo: 'Re-export from StemDeck to switch tempo.',
  noSongTempo: 'Available once Kitbag analyses this song again.',
  constantOnly: `Exported from StemDeck at a constant tempo. Export it in ${MODE_LABEL[TEMPO_MODE.follow]} to switch.`,
} as const;

const BPM_DECIMALS = 1;

const MODE_ORDER: readonly TempoMode[] = [
  TEMPO_MODE.constant,
  TEMPO_MODE.follow,
];

export interface TempoOption {
  readonly value: TempoMode;
  readonly label: string;
  readonly disabled?: boolean;
}

export const tempoModeLabel = (mode: TempoMode) => MODE_LABEL[mode];

export function tempoUnavailable(
  tempo: BundleTempo | null,
  kind: LibraryRow['kind'],
): string | null {
  if (tempo !== null) return null;
  return kind === 'stems' ? tempoText.noTempo : tempoText.noSongTempo;
}

export function tempoOptions(
  tempo: BundleTempo | null,
): readonly TempoOption[] {
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
    return `${FINDER[tempo.source]} found no steady tempo in this song.`;
  return `Constant: ${bpm.toFixed(BPM_DECIMALS)} ${BPM_UNIT}`;
}

function modeHint(tempo: BundleTempo, mode: TempoMode): string {
  return mode === TEMPO_MODE.constant
    ? 'One tempo for the whole song. The click and loop snapping hold steady.'
    : `The beats ${FINDER[tempo.source]} heard. The click and loop snapping speed up and slow down with the band.`;
}

export function tempoHint(tempo: BundleTempo, mode: TempoMode): string {
  return canBuildTempoMode(tempo, TEMPO_MODE.follow)
    ? modeHint(tempo, mode)
    : tempoText.constantOnly;
}
