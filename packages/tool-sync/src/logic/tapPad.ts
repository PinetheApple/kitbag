import { FACT_SEPARATOR } from '@kitbag/core-design';
import { TAPS_TO_SET_TEMPO } from '@kitbag/core-state';

import { shownBpm } from './tempoLine.ts';

export const TAP_PAD_MODE = {
  align: 'align',
  landed: 'landed',
  tempo: 'tempo',
} as const;

export type TapPadMode = (typeof TAP_PAD_MODE)[keyof typeof TAP_PAD_MODE];

export interface TapPadInputs {
  readonly following: boolean;
  readonly locked: boolean;
  readonly songBpm: number | null;
  readonly tappedBpm: number | null;
  readonly tapsLanded: number;
}

export interface TapPadCopy {
  readonly mode: TapPadMode;
  readonly title: string;
  readonly hint: string;
}

export const TAP_TEMPO_TITLE = 'Tap four times on the beat';

export function tapsLeftHint(tapsLanded: number): string {
  const left = TAPS_TO_SET_TEMPO - tapsLanded;
  return left === 1 ? '1 more tap' : `${String(left)} more taps`;
}

function tempoHint({ tappedBpm, tapsLanded }: TapPadInputs): string {
  if (tapsLanded > 0 && tapsLanded < TAPS_TO_SET_TEMPO)
    return tapsLeftHint(tapsLanded);
  if (tappedBpm !== null)
    return `${shownBpm(tappedBpm)} BPM${FACT_SEPARATOR}tap again to change`;
  return 'Taps light up as they land';
}

export function tapPadCopy(inputs: TapPadInputs): TapPadCopy {
  if (inputs.locked)
    return {
      mode: TAP_PAD_MODE.landed,
      title: 'Locked on beat 1',
      hint: 'The click follows the song from here',
    };
  if (inputs.following && inputs.songBpm !== null)
    return {
      mode: TAP_PAD_MODE.align,
      title: 'Tap on a downbeat',
      hint: 'One tap locks the click to the song',
    };
  return {
    mode: TAP_PAD_MODE.tempo,
    title: TAP_TEMPO_TITLE,
    hint: tempoHint(inputs),
  };
}
