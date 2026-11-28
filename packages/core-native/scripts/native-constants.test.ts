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
  parseConstexprInt,
  parseCString,
  parseCStringConstants,
  parseKotlinCodeEnum,
  parseConstexprIntArray,
  parseDefineInt,
  parseDefineNumber,
  parseDocumentedSymmetricBound,
  parseEnum,
  parseFixedOutputRoutes,
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
  polyHeader: read('include', 'kitbag_metronome_poly_api.h'),
  gridHeader: read('include', 'kitbag_metronome_grid_api.h'),
  mixerHeader: read('src', 'mixer', 'mixer.h'),
  metronomeHeader: read('src', 'metronome', 'metronome.h'),
  metronomeRender: read('src', 'metronome', 'metronome_render.cpp'),
  tuningModeHeader: read('src', 'tuner', 'tuning_mode.h'),
  tunerImplHeader: read('src', 'tuner', 'tuner.h'),
  tempoRampHeader: read('src', 'metronome', 'tempo_ramp.h'),
  metronomeTypesHeader: read('src', 'metronome', 'metronome_types.h'),
  transportPlanHeader: read('src', 'mixer', 'transport_plan.h'),
  mixdownHeader: read('include', 'kitbag_mixdown_api.h'),
  clickSoundHeader: read('include', 'kitbag_click_sound_api.h'),
  constantTempoHeader: read('include', 'kitbag_constant_tempo_api.h'),
  metronomeSlotHeader: read('include', 'kitbag_metronome_slot_api.h'),
  outputRoutes: readFileSync(
    join(
      import.meta.dirname,
      '..',
      'android/src/main/java/com/kitbag/corenative/route/OutputRoutes.kt',
    ),
    'utf8',
  ),
  toolEvalHeader: readFileSync(
    join(import.meta.dirname, '..', 'cpp', 'KitbagToolEval.h'),
    'utf8',
  ),
  toolRejections: readFileSync(
    join(
      import.meta.dirname,
      '..',
      'android/src/main/java/com/kitbag/corenative/tools/ToolRejected.kt',
    ),
    'utf8',
  ),
  toolInstallCodes: readFileSync(
    join(
      import.meta.dirname,
      '..',
      'android/src/main/java/com/kitbag/corenative/tools/ToolInstallCodes.kt',
    ),
    'utf8',
  ),
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

describe('parseConstexprInt', () => {
  const header =
    'static constexpr int kMaxBeats = 16;\n' +
    'static constexpr int kMaxPolyAgainst = kMaxBeats;\n' +
    'static constexpr int kOrphan = kMissing;\n' +
    'static constexpr int kLoopA = kLoopB;\n' +
    'static constexpr int kLoopB = kLoopA;\n';
  it('reads a literal', () => {
    expect(parseConstexprInt(header, 'kMaxBeats')).toBe(16);
  });
  it('resolves a value named after another constant', () => {
    expect(parseConstexprInt(header, 'kMaxPolyAgainst')).toBe(16);
  });
  it('throws when the named constant is absent', () => {
    expect(() => parseConstexprInt(header, 'kOrphan')).toThrow(/kMissing/);
  });
  it('throws on an alias cycle instead of recursing forever', () => {
    expect(() => parseConstexprInt(header, 'kLoopA')).toThrow(/alias cycle/);
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

describe('parseDocumentedSymmetricBound', () => {
  const constant = 'static constexpr double kMaxOffsetMs = 250.0;';
  const marker = 'offset in ms';
  it('reads ±constant when the doc agrees', () => {
    expect(
      parseDocumentedSymmetricBound(
        constant,
        'kMaxOffsetMs',
        'offset in ms [-250, 250];',
        marker,
      ),
    ).toEqual({ min: -250, max: 250, maxExclusive: false });
  });
  it('throws when the doc and the constant disagree', () => {
    expect(() =>
      parseDocumentedSymmetricBound(
        constant,
        'kMaxOffsetMs',
        'offset in ms [-100, 100];',
        marker,
      ),
    ).toThrow(/kMaxOffsetMs is 250/);
  });
  it('throws when the constant is absent', () => {
    expect(() =>
      parseDocumentedSymmetricBound(
        '',
        'kMaxOffsetMs',
        'offset in ms [-250, 250];',
        marker,
      ),
    ).toThrow(/kMaxOffsetMs/);
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

describe('parseFixedOutputRoutes', () => {
  it('reads the route families keyed without a device identity, with their kinds', () => {
    expect(parseFixedOutputRoutes(realSources.outputRoutes)).toEqual([
      { id: 'speaker', kind: 'speaker' },
      { id: 'earpiece', kind: 'other' },
      { id: 'wired', kind: 'wired' },
      { id: 'bt-le-broadcast', kind: 'bluetooth' },
    ]);
  });
  it('throws when the families are absent', () => {
    expect(() => parseFixedOutputRoutes('enum class Other {}')).toThrow();
  });
  it('throws when a kind no longer reaches the wire as its lowercased name', () => {
    const renamed = realSources.outputRoutes.replace(
      'name.lowercase()',
      'name',
    );
    expect(renamed).not.toBe(realSources.outputRoutes);
    expect(() => parseFixedOutputRoutes(renamed)).toThrow();
  });
});

// --- the real engine source pins the shipped values --------------------------
describe('collectConstants (real engine source)', () => {
  it('extracts the current constants and re-renders deterministically', () => {
    const c = collectConstants(realSources);
    expect(c.maxGridBeats).toBe(65536);
    expect(c.maxGridGroups).toBe(8);
    expect(c.gridRate).toEqual([
      { name: 'KB_GRID_RATE_SINGLE', value: 0 },
      { name: 'KB_GRID_RATE_DOUBLE', value: 1 },
      { name: 'KB_GRID_RATE_HALF', value: 2 },
    ]);
    expect(c.beatAnalysisVersion).toBe(7);
    expect(renderConstants(c)).toContain('KB_BEAT_ANALYSIS_VERSION = 7;');
    expect(c.maxTracks).toBe(16);
    expect(c.maxBeats).toBe(16);
    expect(c.maxRampBars).toBe(64);
    expect(c.constantTempoBpm).toEqual({ min: 30, max: 300 });
    expect(c.constantTempoMinBeats).toBe(2);
    expect(c.muteBars).toEqual({ min: 1, max: 16 });
    expect(c.minRampBars).toBe(1);
    expect(c.bpm).toEqual({ min: 20, max: 400 });
    expect(c.subdivision).toEqual({ min: 1, max: 16 });
    expect(c.defaultSounds).toEqual({ normal: 4, accent: 4 });
    expect(c.countInOff).toBe(0);
    expect(c.volume).toEqual({ min: 0, max: 2 });
    expect(c.mixerGain).toEqual({ min: 0, max: 2 });
    expect(c.mixerRate).toEqual({ min: 0.5, max: 1 });
    expect(c.mixerPitch).toEqual({ min: -6, max: 6 });
    expect(c.mixerUnityRate).toBe(1);
    expect(renderConstants(c)).toContain('KB_MIXER_UNITY_RATE = 1;');
    expect(renderConstants(c)).toContain(
      'KB_MIXER_RATE_BOUNDS = {\n  min: 0.5,\n  max: 1,\n}',
    );
    expect(renderConstants(c)).toContain(
      'KB_MIXER_PITCH_BOUNDS = {\n  min: -6,\n  max: 6,\n}',
    );
    expect(c.denominators).toEqual([2, 4, 8, 16]);
    expect(c.bpmReferenceDenominator).toBe(4);
    expect(c.soundNames).toEqual([
      'beep',
      'woodblock',
      'click',
      'tom',
      'tick',
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
    expect(c.polyAgainstBar).toBe(0);
    expect(c.polyPhaseNone).toBe(-1);
    expect(c.polyAgainst).toEqual({ min: 1, max: c.maxBeats });
    expect(c.countInBars).toEqual([0, 1, 2, 4]);
    expect(c.defaultCountInSound).toBe(1);
    expect(c.rampSeconds).toEqual({ min: 1, max: 3600 });
    expect(c.rampUnit).toEqual([
      { name: 'KB_RAMP_BARS', value: 0 },
      { name: 'KB_RAMP_SECONDS', value: 1 },
      { name: 'KB_RAMP_MINUTES', value: 2 },
    ]);
    expect(c.rampState).toEqual([
      { name: 'KB_RAMP_STATE_OFF', value: 0 },
      { name: 'KB_RAMP_STATE_STEPPING', value: 1 },
      { name: 'KB_RAMP_STATE_AT_TARGET', value: 2 },
    ]);
    expect(c.mixdownState).toEqual([
      { name: 'KB_MIXDOWN_STATE_IDLE', value: 0 },
      { name: 'KB_MIXDOWN_STATE_RUNNING', value: 1 },
      { name: 'KB_MIXDOWN_STATE_DONE', value: 2 },
      { name: 'KB_MIXDOWN_STATE_FAILED', value: 3 },
      { name: 'KB_MIXDOWN_STATE_CANCELLED', value: 4 },
    ]);
    expect(c.result).toContainEqual({ name: 'KB_ERROR_NO_SPACE', value: 6 });
    expect(c.result).toContainEqual({ name: 'KB_ERROR_TOO_LONG', value: 7 });
    expect(c.mixdownChannels).toBe(2);
    expect(c.mixdownBitsPerSample).toBe(16);
    expect(c.customSoundSlots).toBe(2);
    expect(c.maxCustomSoundSeconds).toBe(2);
    // render twice: identical, so generate:check can byte-diff deterministically.
    expect(renderConstants(c)).toBe(renderConstants(c));
  });
});

describe('collectConstants (custom click sounds)', () => {
  it.each(['KB_CUSTOM_SOUND_SLOTS', 'KB_MAX_CUSTOM_SOUND_SECONDS'])(
    'throws when %s is missing from the header',
    (name) => {
      const clickSoundHeader = realSources.clickSoundHeader.replaceAll(
        `#define ${name} `,
        `#define ${name}_RENAMED `,
      );
      expect(clickSoundHeader).not.toBe(realSources.clickSoundHeader);
      expect(() =>
        collectConstants({ ...realSources, clickSoundHeader }),
      ).toThrow(name);
    },
  );
});

describe('parseCStringConstants', () => {
  const header =
    'inline constexpr const char* kToolErrorArgument = "E_TOOL_ARGUMENT";\n' +
    'inline constexpr const char* kToolErrorRuntimeVersion =\n    "E_TOOL_RUNTIME_VERSION";\n' +
    'inline constexpr const char* kOther = "X";\n';
  it('reads every prefixed string constant in order, across a line wrap', () => {
    expect(parseCStringConstants(header, 'kToolError')).toEqual([
      { name: 'Argument', value: 'E_TOOL_ARGUMENT' },
      { name: 'RuntimeVersion', value: 'E_TOOL_RUNTIME_VERSION' },
    ]);
  });
  it('throws when no constant carries the prefix', () => {
    expect(() => parseCStringConstants(header, 'kMissing')).toThrow();
  });
});

describe('parseCString', () => {
  it('reads one named string constant', () => {
    expect(
      parseCString('inline constexpr const char* kKey = "__k";', 'kKey'),
    ).toBe('__k');
  });
  it('throws when the constant is absent', () => {
    expect(() => parseCString('', 'kKey')).toThrow();
  });
});

describe('collectConstants (tool evaluation)', () => {
  it('reads the eval global and every tool error code from KitbagToolEval.h', () => {
    const c = collectConstants(realSources);
    expect(c.evalVerifiedToolKey).toBe('__kitbagEvalVerifiedTool');
    expect(c.toolErrors).toEqual([
      { name: 'Argument', value: 'E_TOOL_ARGUMENT' },
      { name: 'NotVerified', value: 'E_TOOL_NOT_VERIFIED' },
      { name: 'RuntimeVersion', value: 'E_TOOL_RUNTIME_VERSION' },
      { name: 'NotBytecode', value: 'E_TOOL_NOT_BYTECODE' },
      { name: 'ManifestVersion', value: 'E_TOOL_MANIFEST_VERSION' },
      { name: 'BytecodeVersion', value: 'E_TOOL_BYTECODE_VERSION' },
      { name: 'Eval', value: 'E_TOOL_EVAL' },
    ]);
    const rendered = renderConstants(c);
    expect(rendered).toContain(
      "export const KB_EVAL_VERIFIED_TOOL_KEY = '__kitbagEvalVerifiedTool';",
    );
    expect(rendered).toContain("  notVerified: 'E_TOOL_NOT_VERIFIED',");
    expect(rendered).toContain("export const KB_TOOL_REFUSAL_KEY = 'refused';");
    expect(rendered).toContain(
      "export const KB_TOOL_REFUSAL_DETAIL_KEY = 'detail';",
    );
  });
});

describe('parseKotlinCodeEnum', () => {
  const source =
    'enum class Codes {\n  BAD_ID,\n  ZIP,\n  ;\n  companion object { const val PREFIX = "E_X_" }\n}';
  it('reads every entry with the prefix, in order', () => {
    expect(parseKotlinCodeEnum(source, 'Codes', 'PREFIX')).toEqual([
      { name: 'BadId', value: 'E_X_BAD_ID' },
      { name: 'Zip', value: 'E_X_ZIP' },
    ]);
  });
  it('throws when the enum, its prefix or a plain entry list is missing', () => {
    expect(() => parseKotlinCodeEnum(source, 'Other', 'PREFIX')).toThrow();
    expect(() => parseKotlinCodeEnum(source, 'Codes', 'OTHER')).toThrow();
    expect(() =>
      parseKotlinCodeEnum(
        source.replace('ZIP,', 'ZIP("z"),'),
        'Codes',
        'PREFIX',
      ),
    ).toThrow();
  });
});

describe('collectConstants (tool install codes)', () => {
  it('reads the install stages and downloads states from ToolInstallCodes.kt', () => {
    const c = collectConstants(realSources);
    expect(c.toolInstallStages).toContainEqual({
      name: 'Installed',
      value: 'TOOL_STAGE_INSTALLED',
    });
    expect(c.toolDownloads.map((d) => d.name)).toEqual([
      'Unasked',
      'On',
      'Off',
    ]);
    expect(renderConstants(c)).toContain("  off: 'TOOL_DOWNLOADS_OFF',");
  });
});

describe('collectConstants (tool rejections)', () => {
  it('reads the Kotlin verifier codes from ToolRejected.kt', () => {
    const c = collectConstants(realSources);
    expect(c.toolRejections).toContainEqual({
      name: 'UntrustedKey',
      value: 'E_TOOL_UNTRUSTED_KEY',
    });
    expect(renderConstants(c)).toContain("  signature: 'E_TOOL_SIGNATURE',");
  });
});
