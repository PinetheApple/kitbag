// SPEC §13.7 acceptance for the constant generator. The generator's whole job is
// to fail rather than guess: if a header changes shape, a parser must throw, not
// silently emit a wrong constant (that is the `sync_screen.dart:14` defect,
// §2.3). So every parser is tested both ways — it extracts the right value from
// a good fixture, AND it throws on a malformed one. A parser that cannot throw is
// as worthless as a test that cannot fail.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  collectConstants,
  parseConstexprDouble,
  parseConstexprIntArray,
  parseDefineInt,
  parseDefineNumber,
  parseEnum,
  parseRangeAfter,
  parseSoundNames,
  parseTunerFields,
  renderConstants,
  type NativeSources,
} from './native-constants.ts';

const nativeRoot = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'native',
  'audio_core',
);
const read = (...parts: string[]): string =>
  readFileSync(join(nativeRoot, ...parts), 'utf8');

const realSources: NativeSources = {
  apiHeader: read('include', 'kitbag_api.h'),
  tunerHeader: read('include', 'kitbag_tuner_api.h'),
  mixerHeader: read('src', 'mixer', 'mixer.h'),
  metronomeHeader: read('src', 'metronome', 'metronome.h'),
  metronomeRender: read('src', 'metronome', 'metronome_render.cpp'),
  tuningModeHeader: read('src', 'tuner', 'tuning_mode.h'),
  tunerImplHeader: read('src', 'tuner', 'tuner.h'),
  tempoRampHeader: read('src', 'metronome', 'tempo_ramp.h'),
  metronomeTypesHeader: read('src', 'metronome', 'metronome_types.h'),
};

describe('parseDefineInt', () => {
  it('reads a #define', () => {
    expect(
      parseDefineInt('#define KB_MAX_GRID_BEATS 8192\n', 'KB_MAX_GRID_BEATS'),
    ).toBe(8192);
  });
  it('throws when the define is absent', () => {
    expect(() =>
      parseDefineInt('/* nothing here */', 'KB_MAX_GRID_BEATS'),
    ).toThrow(/KB_MAX_GRID_BEATS/);
  });
});

describe('parseDefineNumber', () => {
  it('reads a parenthesised negative and a fraction', () => {
    expect(parseDefineNumber('#define KB_X (-2) /* c */', 'KB_X')).toBe(-2);
    expect(parseDefineNumber('#define KB_X 0.95 /* c */', 'KB_X')).toBe(0.95);
  });
  it('throws on an expression rather than reading its first token', () => {
    expect(() => parseDefineNumber('#define KB_X (1 << 2)', 'KB_X')).toThrow(
      /KB_X/,
    );
    expect(() => parseDefineNumber('#define KB_X 0.95f', 'KB_X')).toThrow(
      /KB_X/,
    );
  });
});

describe('parseConstexprDouble', () => {
  const src = [
    'static constexpr double kMinA4Hz = 415.5;',
    'static constexpr double kMaxA4Hz = -466;',
  ].join('\n');
  it('reads a fractional and a negative integral double', () => {
    expect(parseConstexprDouble(src, 'kMinA4Hz')).toBe(415.5);
    expect(parseConstexprDouble(src, 'kMaxA4Hz')).toBe(-466);
  });
  it('throws on an absent name or a suffixed literal', () => {
    expect(() => parseConstexprDouble(src, 'kDefaultA4Hz')).toThrow(
      /kDefaultA4Hz/,
    );
    expect(() =>
      parseConstexprDouble('static constexpr double kX = 4.4e2;', 'kX'),
    ).toThrow(/kX/);
  });
  it('reads a namespace-scope inline constexpr double', () => {
    expect(
      parseConstexprDouble(
        'inline constexpr double kMaxBpm = 400.0;',
        'kMaxBpm',
      ),
    ).toBe(400);
  });
  it('throws when the constant is absent', () => {
    expect(() => parseConstexprDouble('double kMaxBpm;', 'kMaxBpm')).toThrow(
      /kMaxBpm/,
    );
  });
});

describe('parseConstexprIntArray', () => {
  it('reads the members of a constexpr int array', () => {
    expect(
      parseConstexprIntArray(
        'static constexpr int kDenominators[] = {2, 4, 8, 16};',
        'kDenominators',
      ),
    ).toEqual([2, 4, 8, 16]);
  });
  it('resolves a named member to its constexpr int in the same source', () => {
    const src =
      'static constexpr int kOff = 7;\n' +
      'static constexpr int kChoices[] = {kOff, 1, 2};';
    expect(parseConstexprIntArray(src, 'kChoices')).toEqual([7, 1, 2]);
  });
  it('throws when the array is absent', () => {
    expect(() =>
      parseConstexprIntArray('int kDenominators = 4;', 'kDenominators'),
    ).toThrow(/kDenominators/);
  });
  it('throws on a non-integer member rather than emitting NaN', () => {
    expect(() =>
      parseConstexprIntArray(
        'static constexpr int kDenominators[] = {2, kFour};',
        'kDenominators',
      ),
    ).toThrow(/kDenominators/);
  });
});

describe('parseEnum', () => {
  it('reads members in order with values', () => {
    const src = 'typedef enum kb_result { KB_OK = 0, KB_ERR = 1, };';
    expect(parseEnum(src, 'kb_result')).toEqual([
      { name: 'KB_OK', value: 0 },
      { name: 'KB_ERR', value: 1 },
    ]);
  });
  it('throws when the enum is absent', () => {
    expect(() => parseEnum('int x = 0;', 'kb_result')).toThrow(/kb_result/);
  });
});

describe('parseRangeAfter', () => {
  it('reads an inclusive range', () => {
    expect(
      parseRangeAfter('offset in ms [-100, 100];', 'offset in ms'),
    ).toEqual({
      min: -100,
      max: 100,
      maxExclusive: false,
    });
  });
  it('reads an exclusive upper bound', () => {
    expect(
      parseRangeAfter('within the bar, [0, 1). ', 'within the bar,'),
    ).toEqual({
      min: 0,
      max: 1,
      maxExclusive: true,
    });
  });
  it('throws when the marker is absent', () => {
    expect(() => parseRangeAfter('no range here', 'offset in ms')).toThrow();
  });
});

describe('parseSoundNames', () => {
  const header = 'static constexpr int kSoundCount = 2;';
  const render = [
    'constexpr SoundPreset kSounds[Metronome::kSoundCount] = {',
    '    {1.0, 2.0},  // beep',
    '    {3.0, 4.0},  // woodblock',
    '};',
  ].join('\n');

  it('reads the trailing preset comments in order', () => {
    expect(parseSoundNames(render, header)).toEqual(['beep', 'woodblock']);
  });
  it('throws when the count disagrees with kSoundCount', () => {
    const headerOfThree = 'static constexpr int kSoundCount = 3;';
    expect(() => parseSoundNames(render, headerOfThree)).toThrow(/kSoundCount/);
  });
});

describe('parseTunerFields', () => {
  it('reads offsets, widths, signedness and scale from the doc table', () => {
    const fields = parseTunerFields(realSources.apiHeader);
    expect(fields.note).toEqual({
      offset: 0,
      width: 16,
      signed: true,
      scale: 1,
    });
    expect(fields.cents).toEqual({
      offset: 16,
      width: 16,
      signed: true,
      scale: 100,
    });
    expect(fields.confidence).toEqual({
      offset: 32,
      width: 16,
      signed: false,
      scale: 10000,
    });
  });
  it('throws when the layout table is absent', () => {
    expect(() => parseTunerFields('no bit table here')).toThrow();
  });
});

// --- the real engine source pins the shipped values --------------------------
describe('collectConstants (real engine source)', () => {
  it('extracts the current constants and re-renders deterministically', () => {
    const c = collectConstants(realSources);
    expect(c.maxGridBeats).toBe(65536);
    expect(c.maxTracks).toBe(16);
    expect(c.maxBeats).toBe(16);
    expect(c.maxRampBars).toBe(64);
    expect(c.muteBars).toEqual({ min: 1, max: 16 });
    expect(c.minRampBars).toBe(1);
    expect(c.bpm).toEqual({ min: 20, max: 400 });
    expect(c.subdivision).toEqual({ min: 1, max: 16 });
    expect(c.defaultSounds).toEqual({ normal: 0, accent: 0 });
    expect(c.countInOff).toBe(0);
    expect(c.volume).toEqual({ min: 0, max: 2 });
    expect(c.mixerGain).toEqual({ min: 0, max: 2 });
    expect(c.denominators).toEqual([2, 4, 8, 16]);
    expect(c.bpmReferenceDenominator).toBe(4);
    expect(c.soundNames).toEqual([
      'beep',
      'woodblock',
      'click',
      'tom',
      'hihat',
      'cowbell',
    ]);
    expect(c.result.map((m) => m.name)).toContain(
      'KB_ERROR_DEVICE_START_FAILED',
    );
    expect(c.accent).toHaveLength(3);
    expect(c.tunerMaxStrings).toBe(12);
    expect(c.tunerAutoString).toBe(-1);
    expect(c.tunerNoString).toBe(-1);
    expect(c.tunerNoNote).toBe(-1);
    expect(c.result.map((m) => m.name)).toContain('KB_ERROR_BUSY');
    expect(c.tunerTunedRatio).toBe(0.95);
    expect(c.tuningStatus.map((m) => m.name)).toEqual([
      'KB_TUNING_NOT_MEASURED',
      'KB_TUNING_TOO_LOW',
      'KB_TUNING_IN_TUNE',
      'KB_TUNING_TOO_HIGH',
    ]);
    expect(c.tunerInstrument).toHaveLength(4);
    expect(c.wrongString).toHaveLength(3);
    expect(c.tunerA4Hz).toEqual({ min: 415, max: 466, default: 440 });
    expect(c.tunerIdleSleepMicros).toBe(2000);
    expect(renderConstants(c)).toContain(
      'KB_TUNER_A4_HZ = {\n  min: 415,\n  max: 466,\n  default: 440,\n}',
    );
    expect(c.minPolyBeats).toBe(2);
    expect(c.maxPolyBeats).toBe(16);
    expect(c.countInBars).toEqual([0, 1, 2, 4]);
    expect(c.defaultCountInSound).toBe(1);
    expect(c.rampSeconds).toEqual({ min: 1, max: 3600 });
    expect(c.rampUnit).toEqual([
      { name: 'KB_RAMP_BARS', value: 0 },
      { name: 'KB_RAMP_SECONDS', value: 1 },
      { name: 'KB_RAMP_MINUTES', value: 2 },
    ]);
    // render twice: identical, so generate:check can byte-diff deterministically.
    expect(renderConstants(c)).toBe(renderConstants(c));
  });
});
