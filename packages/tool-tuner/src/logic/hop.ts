// One analysis hop's worth of tuner state, read from the HostObject on the UI
// thread.

import {
  KB_TUNER_NO_NOTE,
  KB_TUNER_NO_STRING,
  KB_TUNER_TUNED_RATIO,
  KB_TUNING_STATUS,
  KB_WRONG_STRING,
  type KitbagHostObject,
} from '@kitbag/core-native';

export type TunerHostReads = Pick<
  KitbagHostObject,
  | 'tuner_measurement_id'
  | 'tuner_can_hear_note'
  | 'tuner_current_string'
  | 'tuner_possible_wrong_string'
  | 'tuner_wrong_string_direction'
  | 'tuner_status'
  | 'tuner_target_midi'
  | 'tuner_error_cents'
  | 'tuner_in_tune_ratio'
  | 'tuner_in_tune_threshold_cents'
  | 'tuner_listening_paused'
  | 'tuner_no_sound_issue'
>;

export interface TunerHop {
  readonly id: number;
  readonly canHear: boolean;
  readonly currentString: number;
  readonly wrongString: number;
  readonly wrongDirection: number;
  readonly status: number;
  readonly targetMidi: number;
  readonly errorCents: number;
  readonly inTuneRatio: number;
  readonly inTuneThresholdCents: number;
  readonly paused: boolean;
  readonly noSound: boolean;
}

function readFields(host: TunerHostReads): TunerHop {
  'worklet';
  return {
    id: host.tuner_measurement_id,
    canHear: host.tuner_can_hear_note !== 0,
    currentString: host.tuner_current_string,
    wrongString: host.tuner_possible_wrong_string,
    wrongDirection: host.tuner_wrong_string_direction,
    status: host.tuner_status,
    targetMidi: host.tuner_target_midi,
    errorCents: host.tuner_error_cents,
    inTuneRatio: host.tuner_in_tune_ratio,
    inTuneThresholdCents: host.tuner_in_tune_threshold_cents,
    paused: host.tuner_listening_paused !== 0,
    noSound: host.tuner_no_sound_issue !== 0,
  };
}

/**
 * Reads every field, then the id again; if a hop landed in between, reads
 * once more. Hops are ~43 ms apart, so a second straddle is not expected; if
 * one happens the frame shows a mixed hop that the next hop replaces.
 */
export function readHop(host: TunerHostReads): TunerHop {
  'worklet';
  const first = readFields(host);
  if (host.tuner_measurement_id === first.id) return first;
  return readFields(host);
}

/** A note is on the readout: heard, with a target to measure against. */
export function isHeard(hop: TunerHop): boolean {
  'worklet';
  return hop.canHear && !hop.paused && hop.targetMidi !== KB_TUNER_NO_NOTE;
}

/** In-tune lock: the needle snaps to centre while this holds. */
export function isLocked(hop: TunerHop): boolean {
  'worklet';
  return isHeard(hop) && hop.inTuneRatio >= KB_TUNER_TUNED_RATIO;
}

/** The human-speed slice of a hop the screen renders through React. */
export interface TunerDiscrete {
  readonly heard: boolean;
  readonly status: number;
  readonly targetMidi: number;
  readonly currentString: number;
  readonly wrongString: number;
  readonly wrongDirection: number;
  readonly noSound: boolean;
}

/** Nothing heard yet: the state on entry and after a reset. */
export const QUIET_DISCRETE: TunerDiscrete = {
  heard: false,
  status: KB_TUNING_STATUS.KB_TUNING_NOT_MEASURED,
  targetMidi: KB_TUNER_NO_NOTE,
  currentString: KB_TUNER_NO_STRING,
  wrongString: KB_TUNER_NO_STRING,
  wrongDirection: KB_WRONG_STRING.KB_WRONG_STRING_NONE,
  noSound: false,
};

/** `status` is the displayed one, so speech agrees with the caption. */
export function discreteOf(hop: TunerHop, status: number): TunerDiscrete {
  'worklet';
  const heard = isHeard(hop);
  return {
    heard,
    status,
    targetMidi: hop.targetMidi,
    currentString: hop.currentString,
    wrongString: hop.wrongString,
    wrongDirection: hop.wrongDirection,
    noSound: hop.noSound,
  };
}

export function sameDiscrete(a: TunerDiscrete, b: TunerDiscrete): boolean {
  'worklet';
  return (
    a.heard === b.heard &&
    a.status === b.status &&
    a.targetMidi === b.targetMidi &&
    a.currentString === b.currentString &&
    a.wrongString === b.wrongString &&
    a.wrongDirection === b.wrongDirection &&
    a.noSound === b.noSound
  );
}
