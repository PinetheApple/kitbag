import { FACT_SEPARATOR, tapsLeftText } from '@kitbag/core-design';
import { TAP_STEP, TAPS_TO_SET_TEMPO, type TapAlong } from '@kitbag/core-state';

import {
  chooseOneCopy,
  chooseTempoCopy,
  idleCopy,
  oneSetCopy,
  pausedCopy,
  retapCopy,
  tappingCopy,
  type AlongCopy,
} from './tapAlongCopy.ts';
import { shownBpm } from './tempoLine.ts';

export const TAP_PAD_MODE = {
  along: 'along',
  landed: 'landed',
  tempo: 'tempo',
} as const;

export type TapPadMode = (typeof TAP_PAD_MODE)[keyof typeof TAP_PAD_MODE];

export interface TapPadInputs {
  readonly following: boolean;
  readonly locked: boolean;
  readonly playing: boolean;
  readonly songBpm: number | null;
  readonly tappedBpm: number | null;
  readonly tapsLanded: number;
  readonly retap: boolean;
  readonly offered: boolean;
  readonly tapAlong: TapAlong;
}

export interface TapPadCopy extends AlongCopy {
  readonly mode: TapPadMode;
}

export const TAP_TEMPO_TITLE = 'Tap four times on the beat';

export function tapsLeftHint(tapsLanded: number): string {
  return tapsLeftText(tapsLanded, TAPS_TO_SET_TEMPO);
}

function tempoHint({ tappedBpm, tapsLanded }: TapPadInputs): string {
  if (tapsLanded > 0 && tapsLanded < TAPS_TO_SET_TEMPO)
    return tapsLeftHint(tapsLanded);
  if (tappedBpm !== null)
    return `${shownBpm(tappedBpm)} BPM${FACT_SEPARATOR}tap again to change`;
  return 'Taps light up as they land';
}

const plain = { leds: null, badges: [], action: null, active: false } as const;

const tempoCopy = (inputs: TapPadInputs): TapPadCopy => ({
  ...plain,
  mode: TAP_PAD_MODE.tempo,
  title: TAP_TEMPO_TITLE,
  hint: tempoHint(inputs),
  leds: inputs.tapsLanded,
});

const LANDED: TapPadCopy = {
  ...plain,
  mode: TAP_PAD_MODE.landed,
  title: 'Locked on beat 1',
  hint: 'The click follows the song from here',
};

function stepCopy({ tapAlong, songBpm }: TapPadInputs): AlongCopy {
  if (tapAlong.step === TAP_STEP.chooseOne)
    return chooseOneCopy(tapAlong, songBpm);
  if (tapAlong.step === TAP_STEP.oneSet) return oneSetCopy(tapAlong.movedBeats);
  return chooseTempoCopy(tapAlong);
}

function alongCopy(inputs: TapPadInputs): AlongCopy | null {
  const { tapAlong, songBpm } = inputs;
  if (tapAlong.step !== TAP_STEP.tapping) return stepCopy(inputs);
  if (inputs.locked && !inputs.retap) return null;
  if (!inputs.playing && tapAlong.taps.length > 0) return pausedCopy(tapAlong);
  if (inputs.locked && tapAlong.taps.length < TAPS_TO_SET_TEMPO)
    return retapCopy(tapAlong, songBpm ?? 0);
  if (tapAlong.taps.length === 0) return idleCopy(songBpm, inputs.offered);
  return tappingCopy(tapAlong, songBpm);
}

export function tapPadCopy(inputs: TapPadInputs): TapPadCopy {
  if (!inputs.following) return inputs.locked ? LANDED : tempoCopy(inputs);
  const copy = alongCopy(inputs);
  return copy === null ? LANDED : { ...copy, mode: TAP_PAD_MODE.along };
}
