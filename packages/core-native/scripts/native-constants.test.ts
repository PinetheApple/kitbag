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
  parseConstexprIntArray,
  parseDefineInt,
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
  mixerHeader: read('src', 'mixer', 'mixer.h'),
  metronomeHeader: read('src', 'metronome', 'metronome.h'),
  metronomeRender: read('src', 'metronome', 'metronome_render.cpp'),
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

describe('parseConstexprIntArray', () => {
  it('reads the members of a constexpr int array', () => {
    expect(
      parseConstexprIntArray(
        'static constexpr int kDenominators[] = {2, 4, 8, 16};',
        'kDenominators',
      ),
    ).toEqual([2, 4, 8, 16]);
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
    expect(c.maxGridBeats).toBe(8192);
    expect(c.maxTracks).toBe(16);
    expect(c.maxBeats).toBe(16);
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
    // render twice: identical, so generate:check can byte-diff deterministically.
    expect(renderConstants(c)).toBe(renderConstants(c));
  });
});
