import {
  KB_TUNER_NO_NOTE,
  KB_TUNER_NO_STRING,
  KB_TUNER_TUNED_RATIO,
  KB_TUNING_STATUS,
  KB_WRONG_STRING,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  discreteOf,
  isHeard,
  isLocked,
  readHop,
  sameDiscrete,
  type TunerHop,
  type TunerHostReads,
} from './hop.ts';

type Fields = { -readonly [K in keyof TunerHostReads]: TunerHostReads[K] };

function fields(overrides: Partial<Fields> = {}): Fields {
  return {
    tuner_measurement_id: 7,
    tuner_can_hear_note: 1,
    tuner_current_string: 3,
    tuner_possible_wrong_string: KB_TUNER_NO_STRING,
    tuner_wrong_string_direction: KB_WRONG_STRING.KB_WRONG_STRING_NONE,
    tuner_status: KB_TUNING_STATUS.KB_TUNING_TOO_LOW,
    tuner_target_midi: 55,
    tuner_error_cents: -4,
    tuner_in_tune_ratio: 0,
    tuner_in_tune_threshold_cents: 7,
    tuner_listening_paused: 0,
    tuner_no_sound_issue: 0,
    ...overrides,
  };
}

// A host whose state advances to `next` after `afterReads` property reads,
// as if the analysis thread published a hop mid-read.
function advancingHost(first: Fields, next: Fields, afterReads: number) {
  let reads = 0;
  const host = {} as TunerHostReads;
  for (const key of Object.keys(first) as (keyof Fields)[]) {
    Object.defineProperty(host, key, {
      get: () => {
        reads++;
        return reads > afterReads ? next[key] : first[key];
      },
    });
  }
  return host;
}

function hop(overrides: Partial<Fields> = {}): TunerHop {
  return readHop(fields(overrides));
}

describe('readHop', () => {
  it('maps every field', () => {
    expect(hop()).toEqual({
      id: 7,
      canHear: true,
      currentString: 3,
      wrongString: KB_TUNER_NO_STRING,
      wrongDirection: KB_WRONG_STRING.KB_WRONG_STRING_NONE,
      status: KB_TUNING_STATUS.KB_TUNING_TOO_LOW,
      targetMidi: 55,
      errorCents: -4,
      inTuneRatio: 0,
      inTuneThresholdCents: 7,
      paused: false,
      noSound: false,
    });
  });

  it('re-reads when a hop lands between its reads', () => {
    const before = fields({ tuner_measurement_id: 7, tuner_target_midi: 55 });
    const after = fields({ tuner_measurement_id: 8, tuner_target_midi: 50 });
    // The hop lands after the id and two fields: target_midi is already new.
    const result = readHop(advancingHost(before, after, 3));
    expect(result.id).toBe(8);
    expect(result.targetMidi).toBe(50);
    expect(result.errorCents).toBe(after.tuner_error_cents);
  });

  it('reads once when nothing moved', () => {
    let reads = 0;
    const base = fields();
    const host = advancingHost(base, base, Number.POSITIVE_INFINITY);
    const counting = new Proxy(host, {
      get: (target, key) => {
        reads++;
        return Reflect.get(target, key) as unknown;
      },
    });
    readHop(counting);
    // Twelve fields plus the closing id check.
    expect(reads).toBe(13);
  });
});

describe('isHeard and isLocked', () => {
  it('needs a held note with a target, and not a reset pause', () => {
    expect(isHeard(hop())).toBe(true);
    expect(isHeard(hop({ tuner_can_hear_note: 0 }))).toBe(false);
    expect(isHeard(hop({ tuner_target_midi: KB_TUNER_NO_NOTE }))).toBe(false);
    expect(isHeard(hop({ tuner_listening_paused: 1 }))).toBe(false);
  });

  it('locks from the engine ratio, not from the cents', () => {
    expect(isLocked(hop({ tuner_in_tune_ratio: KB_TUNER_TUNED_RATIO }))).toBe(
      true,
    );
    expect(
      isLocked(
        hop({
          tuner_in_tune_ratio: KB_TUNER_TUNED_RATIO - 0.01,
          tuner_error_cents: 0,
        }),
      ),
    ).toBe(false);
    expect(
      isLocked(hop({ tuner_in_tune_ratio: 1, tuner_can_hear_note: 0 })),
    ).toBe(false);
  });
});

describe('discreteOf', () => {
  const { KB_TUNING_TOO_LOW, KB_TUNING_IN_TUNE } = KB_TUNING_STATUS;

  it('ignores the per-hop numbers', () => {
    const a = discreteOf(
      hop({ tuner_error_cents: -4, tuner_in_tune_ratio: 0.2 }),
      KB_TUNING_TOO_LOW,
    );
    const b = discreteOf(
      hop({ tuner_error_cents: -3, tuner_in_tune_ratio: 0.3 }),
      KB_TUNING_TOO_LOW,
    );
    expect(sameDiscrete(a, b)).toBe(true);
  });

  it('carries the status it is given, not the engine hop status', () => {
    const shown = discreteOf(
      hop({ tuner_status: KB_TUNING_TOO_LOW }),
      KB_TUNING_IN_TUNE,
    );
    expect(shown.status).toBe(KB_TUNING_IN_TUNE);
  });

  it('changes with status, string, wrong-string hint and silence', () => {
    const base = discreteOf(hop(), KB_TUNING_TOO_LOW);
    expect(sameDiscrete(base, discreteOf(hop(), KB_TUNING_IN_TUNE))).toBe(
      false,
    );
    for (const changed of [
      hop({ tuner_current_string: 2 }),
      hop({ tuner_possible_wrong_string: 4 }),
      hop({
        tuner_wrong_string_direction: KB_WRONG_STRING.KB_WRONG_STRING_BELOW,
      }),
      hop({ tuner_no_sound_issue: 1 }),
      hop({ tuner_can_hear_note: 0 }),
      hop({ tuner_target_midi: 50 }),
    ]) {
      expect(sameDiscrete(base, discreteOf(changed, KB_TUNING_TOO_LOW))).toBe(
        false,
      );
    }
  });
});
