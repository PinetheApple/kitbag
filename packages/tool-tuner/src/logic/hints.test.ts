import { KB_TUNING_STATUS, KB_WRONG_STRING } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { tunerHint, type HintInputs } from './hints.ts';
import { QUIET_DISCRETE, type TunerDiscrete } from './hop.ts';

const QUIET = QUIET_DISCRETE;

const HEARD: TunerDiscrete = {
  ...QUIET,
  heard: true,
  status: KB_TUNING_STATUS.KB_TUNING_TOO_LOW,
  targetMidi: 50,
  currentString: 2,
};

function inputs(overrides: Partial<HintInputs> = {}): HintInputs {
  return {
    permission: 'granted',
    mic: 'listening',
    mode: 'manual',
    notes: [40, 45, 50, 55, 59, 64],
    discrete: QUIET,
    ...overrides,
  };
}

describe('tunerHint', () => {
  it('is quiet when listening and nothing is wrong', () => {
    expect(tunerHint(inputs())).toBeUndefined();
    expect(tunerHint(inputs({ discrete: HEARD }))).toBeUndefined();
  });

  it('asks again after a denial and sends a permanent denial to Settings', () => {
    expect(
      tunerHint(inputs({ permission: 'denied', mic: 'off' }))?.action?.kind,
    ).toBe('requestMic');
    expect(
      tunerHint(inputs({ permission: 'blocked', mic: 'off' }))?.action?.kind,
    ).toBe('openSettings');
  });

  it('offers a retry when the device will not open', () => {
    const hint = tunerHint(inputs({ mic: 'unavailable' }));
    expect(hint?.kind).toBe('micUnavailable');
    expect(hint?.action?.kind).toBe('retryMic');
  });

  it('says nothing while the permission is still being asked', () => {
    expect(
      tunerHint(inputs({ permission: 'unknown', mic: 'off' })),
    ).toBeUndefined();
    expect(tunerHint(inputs({ mic: 'starting' }))).toBeUndefined();
  });

  it('names the heard string and the target string', () => {
    const hint = tunerHint(inputs({ discrete: { ...HEARD, wrongString: 1 } }));
    expect(hint).toEqual({
      kind: 'wrongString',
      text: 'That sounds like string 5 (A), not string 4 (D).',
    });
  });

  it('gives the side when only the direction is known', () => {
    expect(
      tunerHint(
        inputs({
          discrete: {
            ...HEARD,
            wrongDirection: KB_WRONG_STRING.KB_WRONG_STRING_BELOW,
          },
        }),
      )?.text,
    ).toBe('That sounds lower than string 4 (D). Are you on the right string?');
    expect(
      tunerHint(
        inputs({
          discrete: {
            ...HEARD,
            wrongDirection: KB_WRONG_STRING.KB_WRONG_STRING_ABOVE,
          },
        }),
      )?.text,
    ).toContain('higher than string 4');
  });

  it.each(['auto', 'chromatic'] as const)(
    'has no wrong string in %s mode',
    (mode) => {
      const wrong = { ...HEARD, wrongString: 1 };
      expect(tunerHint(inputs({ mode, discrete: wrong }))).toBeUndefined();
      const side = {
        ...HEARD,
        wrongDirection: KB_WRONG_STRING.KB_WRONG_STRING_BELOW,
      };
      expect(tunerHint(inputs({ mode, discrete: side }))).toBeUndefined();
    },
  );

  it('reports silence after the engine raises it', () => {
    expect(
      tunerHint(inputs({ discrete: { ...QUIET, noSound: true } }))?.kind,
    ).toBe('noSound');
  });

  it('puts permission before everything else', () => {
    expect(
      tunerHint(
        inputs({
          permission: 'denied',
          mic: 'unavailable',
          discrete: { ...QUIET, noSound: true },
        }),
      )?.kind,
    ).toBe('permission');
  });
});
