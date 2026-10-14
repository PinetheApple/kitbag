// The one hint card under the strip: what is stopping a reading, or what the
// engine thinks is wrong with it. Text plus an icon and an action, never
// colour alone (SPEC §12.6). One at a time, most blocking first.

import { KB_TUNER_NO_STRING, KB_WRONG_STRING } from '@kitbag/core-native';
import type { MicStatus, TunerState } from '@kitbag/core-state';

import { pitchClassName } from './notes.ts';
import { stringNumber } from './tunings.ts';
import type { TunerDiscrete } from './hop.ts';

export type HintAction = 'requestMic' | 'openSettings' | 'retryMic';

export interface TunerHint {
  readonly kind: 'permission' | 'micUnavailable' | 'wrongString' | 'noSound';
  readonly text: string;
  readonly action?: { readonly kind: HintAction; readonly label: string };
}

export interface HintInputs {
  readonly permission: TunerState['permission'];
  readonly mic: MicStatus;
  readonly chromatic: boolean;
  readonly notes: readonly number[];
  readonly discrete: TunerDiscrete;
}

const LISTENS_WHILE_OPEN =
  'The tuner needs the microphone to hear your instrument. It listens only while this screen is open.';

function stringName(index: number, notes: readonly number[]): string {
  const note = notes[index];
  const name = note === undefined ? '' : ` (${pitchClassName(note)})`;
  return `string ${String(stringNumber(index, notes.length))}${name}`;
}

function wrongStringText(
  discrete: TunerDiscrete,
  notes: readonly number[],
): string | undefined {
  const target = discrete.currentString;
  if (target === KB_TUNER_NO_STRING) return undefined;
  if (discrete.wrongString !== KB_TUNER_NO_STRING) {
    return `That sounds like ${stringName(discrete.wrongString, notes)}, not ${stringName(target, notes)}.`;
  }
  if (discrete.wrongDirection === KB_WRONG_STRING.KB_WRONG_STRING_BELOW) {
    return `That sounds lower than ${stringName(target, notes)}. Are you on the right string?`;
  }
  if (discrete.wrongDirection === KB_WRONG_STRING.KB_WRONG_STRING_ABOVE) {
    return `That sounds higher than ${stringName(target, notes)}. Are you on the right string?`;
  }
  return undefined;
}

export function tunerHint(inputs: HintInputs): TunerHint | undefined {
  const { permission, mic, chromatic, notes, discrete } = inputs;
  if (permission === 'denied') {
    return {
      kind: 'permission',
      text: LISTENS_WHILE_OPEN,
      action: { kind: 'requestMic', label: 'Allow microphone' },
    };
  }
  if (permission === 'blocked') {
    return {
      kind: 'permission',
      text: `${LISTENS_WHILE_OPEN} Microphone access is off for Kitbag; turn it on in Settings.`,
      action: { kind: 'openSettings', label: 'Open settings' },
    };
  }
  if (mic === 'unavailable') {
    return {
      kind: 'micUnavailable',
      text: "Couldn't start the microphone.",
      action: { kind: 'retryMic', label: 'Retry' },
    };
  }
  if (mic !== 'listening') return undefined;
  if (!chromatic && discrete.heard) {
    const text = wrongStringText(discrete, notes);
    if (text !== undefined) return { kind: 'wrongString', text };
  }
  if (discrete.noSound) {
    return {
      kind: 'noSound',
      text: "Can't hear anything. Hold the phone closer to the instrument.",
    };
  }
  return undefined;
}
