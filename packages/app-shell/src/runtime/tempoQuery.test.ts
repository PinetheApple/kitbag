import { KB_RAMP_UNIT } from '@kitbag/core-native';
import type {
  MetronomeSettingsInput,
  StandaloneMetronomePersistence,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { queriedNumber, queriedTempoWins } from './tempoQuery.ts';

const STORED = { bpm: 125, subdivision: 3 };
const RAMP = {
  enabled: true,
  startBpm: 100,
  targetBpm: 140,
  stepBpm: 10,
  interval: 2,
  unit: KB_RAMP_UNIT.KB_RAMP_BARS,
  loop: false,
};

function storedAs(
  settings: Partial<MetronomeSettingsInput>,
): StandaloneMetronomePersistence {
  return { load: () => settings, save: () => undefined };
}

const stored = storedAs(STORED);

describe('a web tempo in the URL', () => {
  it('beats the saved tempo and leaves the rest restored', () => {
    expect(queriedTempoWins(stored, '?bpm=90').load()).toEqual({
      subdivision: 3,
    });
  });

  it.each(['', '?bpm=', '?bpm=fast', '?phase=0.5'])(
    'leaves the saved tempo when %j sets none',
    (search) => {
      expect(queriedTempoWins(stored, search).load()).toEqual(STORED);
    },
  );

  it('restores a saved ramp switched off, so it cannot move that tempo', () => {
    const ramped = storedAs({ ...STORED, ramp: RAMP });
    expect(queriedTempoWins(ramped, '?bpm=90').load()).toEqual({
      subdivision: 3,
      ramp: { ...RAMP, enabled: false },
    });
  });
});

describe('a number in the URL', () => {
  it.each([
    ['?bpm=90', 90],
    ['?bpm=', undefined],
    ['?bpm=%20', undefined],
    ['?bpm=fast', undefined],
    ['?phase=0.5', undefined],
  ])('reads %j as %j', (search, expected) => {
    expect(queriedNumber(search, 'bpm')).toBe(expected);
  });
});
