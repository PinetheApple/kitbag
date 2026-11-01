import {
  KB_COUNT_IN_BARS,
  KB_COUNT_IN_OFF,
  KB_DEFAULT_COUNT_IN_SOUND,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import type { CountInConfig } from './config.ts';
import {
  COUNT_IN_SCOPE,
  DEFAULT_COUNT_IN_SCOPE,
  songCountIn,
} from './countInScope.ts';

const LIVE: CountInConfig = {
  bars: KB_COUNT_IN_BARS[1],
  distinct: false,
  sound: KB_DEFAULT_COUNT_IN_SOUND,
};
const UNSUPPORTED_BARS = 3;

describe('songCountIn', () => {
  it('defaults to per-song, so existing users keep each song its own count-in', () => {
    expect(DEFAULT_COUNT_IN_SCOPE).toBe(COUNT_IN_SCOPE.perSong);
  });

  it('per song takes the song bars and keeps the live sound', () => {
    expect(songCountIn(COUNT_IN_SCOPE.perSong, 4, LIVE)).toEqual({
      ...LIVE,
      bars: 4,
    });
  });

  it('per song starts a song with no count-in without one', () => {
    expect(
      songCountIn(COUNT_IN_SCOPE.perSong, KB_COUNT_IN_OFF, LIVE).bars,
    ).toBe(KB_COUNT_IN_OFF);
    expect(
      songCountIn(COUNT_IN_SCOPE.perSong, UNSUPPORTED_BARS, LIVE).bars,
    ).toBe(KB_COUNT_IN_OFF);
  });

  it('always keeps the live count-in whatever the song holds', () => {
    expect(songCountIn(COUNT_IN_SCOPE.always, 4, LIVE)).toBe(LIVE);
    expect(songCountIn(COUNT_IN_SCOPE.always, KB_COUNT_IN_OFF, LIVE)).toBe(
      LIVE,
    );
  });
});
