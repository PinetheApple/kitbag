import {
  bpmFact,
  correctedBpm,
  TEMPO_CORRECTION,
  TEMPO_CORRECTIONS,
  type TempoCorrection,
} from '@kitbag/core-state';

import { SAVED } from './songMeterText.ts';

export const TEMPO_CORRECTION_COPY = {
  title: 'Tempo correction',
  section: 'Beat grid',
  why: 'For a beat found too slow or too fast. The meter and bar 1 are kept.',
  done: 'Done',
  close: 'Close the tempo correction sheet',
  saveFailed: 'Could not save the tempo correction.',
  restored: `Back to the detected tempo. ${SAVED}`,
} as const;

const SHOWN: Readonly<Record<TempoCorrection, string>> = {
  half: '÷2',
  twoThirds: '×2/3',
  none: '×1',
  threeHalves: '×3/2',
  double: '×2',
};

const SPOKEN: Readonly<Record<TempoCorrection, string>> = {
  half: 'half',
  twoThirds: 'two thirds',
  none: 'as detected',
  threeHalves: 'one and a half times',
  double: 'double',
};

const VALUE_SEPARATOR = ' · ';
const SPOKEN_SEPARATOR = ', ';

export interface TempoCorrectionOption {
  readonly value: TempoCorrection;
  readonly label: string;
  readonly detail?: string;
  readonly accessibilityLabel: string;
}

export interface TempoCorrectionText {
  readonly shown: string;
  readonly spoken: string;
}

function bpmOf(detectedBpm: number | null, correction: TempoCorrection) {
  return bpmFact(correctedBpm(detectedBpm, correction));
}

function joined(parts: readonly (string | undefined)[], separator: string) {
  return parts.filter((part) => part !== undefined).join(separator);
}

const capitalised = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

export function tempoCorrectionValue(
  correction: TempoCorrection,
  detectedBpm: number | null,
): TempoCorrectionText {
  const bpm = bpmOf(detectedBpm, correction)?.text;
  return {
    shown: joined([SHOWN[correction], bpm], VALUE_SEPARATOR),
    spoken: joined([SPOKEN[correction], bpm], SPOKEN_SEPARATOR),
  };
}

export function tempoCorrectionOptions(
  detectedBpm: number | null,
): readonly TempoCorrectionOption[] {
  return TEMPO_CORRECTIONS.map((correction) => {
    const bpm = bpmOf(detectedBpm, correction);
    const { spoken } = tempoCorrectionValue(correction, detectedBpm);
    return {
      value: correction,
      label: SHOWN[correction],
      ...(bpm === null ? {} : { detail: bpm.value }),
      accessibilityLabel: capitalised(spoken),
    };
  });
}

export function detectedTempoHint(detectedBpm: number | null): string | null {
  const bpm = bpmFact(detectedBpm);
  return bpm === null ? null : `Detected: ${bpm.text}`;
}

export function tempoSetText(
  correction: TempoCorrection,
  detectedBpm: number | null,
): TempoCorrectionText {
  if (correction === TEMPO_CORRECTION.none)
    return {
      shown: TEMPO_CORRECTION_COPY.restored,
      spoken: TEMPO_CORRECTION_COPY.restored,
    };
  const value = tempoCorrectionValue(correction, detectedBpm);
  return {
    shown: `Tempo set to ${value.shown}. ${SAVED}`,
    spoken: `Tempo set to ${value.spoken}. ${SAVED}`,
  };
}
