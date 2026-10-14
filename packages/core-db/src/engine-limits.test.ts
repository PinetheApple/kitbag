import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ACCENT_LEVELS,
  DEFAULT_DENOMINATOR,
  DENOMINATORS,
  MAX_BEATS,
  MAX_BPM,
  MAX_MUTE_BARS,
  MAX_POLY_BEATS,
  MAX_RAMP_BARS,
  MAX_SUBDIVISION,
  MIN_BPM,
  NORMAL_ACCENT,
  SOUND_COUNT,
} from './preset-rules';

const source = (path: string) =>
  readFileSync(
    new URL(`../../../native/audio_core/${path}`, import.meta.url),
    'utf8',
  );

const headers = {
  'metronome.h': source('src/metronome/metronome.h'),
  'metronome_types.h': source('src/metronome/metronome_types.h'),
  'tempo_ramp.h': source('src/metronome/tempo_ramp.h'),
};
const api = source('include/kitbag_api.h');

function constant(
  name: string,
  header: keyof typeof headers = 'metronome.h',
): string {
  const match = new RegExp(`constexpr \\w+ ${name}(?:\\[\\])? = ([^;]+);`).exec(
    headers[header],
  );
  if (!match?.[1]) throw new Error(`${name} not found in ${header}`);
  return match[1];
}

describe('engine limits mirrored in core-db', () => {
  it('match the metronome headers', () => {
    expect(Number(constant('kMinBpm', 'metronome_types.h'))).toBe(MIN_BPM);
    expect(Number(constant('kMaxBpm', 'metronome_types.h'))).toBe(MAX_BPM);
    expect(Number(constant('kMaxBeats'))).toBe(MAX_BEATS);
    expect(Number(constant('kMaxPolyBeats'))).toBe(MAX_POLY_BEATS);
    expect(Number(constant('kSoundCount'))).toBe(SOUND_COUNT);
    expect(Number(constant('kMaxSubdivision'))).toBe(MAX_SUBDIVISION);
    expect(Number(constant('kMaxBars', 'tempo_ramp.h'))).toBe(MAX_RAMP_BARS);
    expect(Number(constant('kMaxMuteBars'))).toBe(MAX_MUTE_BARS);
    expect(Number(constant('kBpmReferenceDenominator'))).toBe(
      DEFAULT_DENOMINATOR,
    );
    expect(constant('kDenominators')).toBe(`{${DENOMINATORS.join(', ')}}`);
  });

  it('match the kb_accent enum in kitbag_api.h', () => {
    const body = /typedef enum kb_accent \{([^}]*)\}/.exec(api)?.[1] ?? '';
    expect(body.match(/KB_ACCENT_\w+ = \d+/g)).toHaveLength(ACCENT_LEVELS);
    expect(/KB_ACCENT_NORMAL = (\d+)/.exec(body)?.[1]).toBe(
      String(NORMAL_ACCENT),
    );
  });
});
