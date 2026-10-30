import {
  parseConstexprDouble,
  parseConstexprFloat,
  parseConstexprInt,
  parseConstexprIntArray,
  parseDefineInt,
  parseDefineNumber,
  parseEnum,
  parseRangeAfter,
  parseSoundNames,
  parseTunerFields,
  type Bounds,
  type EnumMember,
  type RangeBound,
  type TunerFields,
} from './native-parsers.ts';

export * from './native-parsers.ts';
export { renderConstants } from './native-render.ts';

export interface NativeSources {
  /** native/audio_core/include/kitbag_api.h — the shipped C ABI. */
  readonly apiHeader: string;
  /** native/audio_core/include/kitbag_tuner_api.h — its tuning-mode section. */
  readonly tunerHeader: string;
  /** native/audio_core/src/mixer/mixer.h — kMaxTracks lives here, not the ABI. */
  readonly mixerHeader: string;
  /** native/audio_core/src/metronome/metronome.h — kSoundCount, kMaxBeats, kDenominators. */
  readonly metronomeHeader: string;
  /** native/audio_core/src/metronome/metronome_render.cpp — the sound presets. */
  readonly metronomeRender: string;
  /** native/audio_core/src/tuner/tuning_mode.h — the A4 reference bounds. */
  readonly tuningModeHeader: string;
  /** native/audio_core/src/tuner/tuner.h — the analysis thread's idle sleep. */
  readonly tunerImplHeader: string;
  /** native/audio_core/src/metronome/tempo_ramp.h — ramp duration bounds. */
  readonly tempoRampHeader: string;
  /** native/audio_core/src/metronome/metronome_types.h — the tempo range. */
  readonly metronomeTypesHeader: string;
}

export interface NativeConstants {
  readonly maxGridBeats: number;
  readonly maxTracks: number;
  readonly maxBeats: number;
  readonly minPolyBeats: number;
  readonly maxPolyBeats: number;
  readonly countInBars: readonly number[];
  readonly countInOff: number;
  readonly defaultCountInSound: number;
  readonly defaultSounds: { readonly normal: number; readonly accent: number };
  readonly minRampBars: number;
  readonly maxRampBars: number;
  readonly minRampStepBpm: number;
  readonly muteBars: Bounds;
  readonly subdivision: Bounds;
  readonly bpm: Bounds;
  readonly volume: Bounds;
  readonly mixerGain: Bounds;
  readonly rampSeconds: Bounds;
  readonly rampUnit: readonly EnumMember[];
  readonly rampState: readonly EnumMember[];
  readonly bpmReferenceDenominator: number;
  readonly denominators: readonly number[];
  readonly soundNames: readonly string[];
  readonly result: readonly EnumMember[];
  readonly accent: readonly EnumMember[];
  readonly latencyOffsetMsBounds: RangeBound;
  readonly barPhaseBounds: RangeBound;
  readonly tunerFields: TunerFields;
  readonly tunerMaxStrings: number;
  readonly tunerAutoString: number;
  readonly tunerNoString: number;
  readonly tunerNoNote: number;
  readonly tunerTunedRatio: number;
  readonly tunerInstrument: readonly EnumMember[];
  readonly tuningStatus: readonly EnumMember[];
  readonly wrongString: readonly EnumMember[];
  readonly tunerA4Hz: {
    readonly min: number;
    readonly max: number;
    readonly default: number;
  };
  readonly tunerIdleSleepMicros: number;
}

export function collectConstants(sources: NativeSources): NativeConstants {
  return {
    maxGridBeats: parseDefineInt(sources.apiHeader, 'KB_MAX_GRID_BEATS'),
    maxTracks: parseConstexprInt(sources.mixerHeader, 'kMaxTracks'),
    maxBeats: parseConstexprInt(sources.metronomeHeader, 'kMaxBeats'),
    minPolyBeats: parseConstexprInt(sources.metronomeHeader, 'kMinPolyBeats'),
    maxPolyBeats: parseConstexprInt(sources.metronomeHeader, 'kMaxPolyBeats'),
    countInBars: parseConstexprIntArray(
      sources.metronomeHeader,
      'kCountInBarChoices',
    ),
    countInOff: parseConstexprInt(sources.metronomeHeader, 'kCountInOff'),
    defaultCountInSound: parseConstexprInt(
      sources.metronomeHeader,
      'kDefaultCountInSound',
    ),
    defaultSounds: {
      normal: parseConstexprInt(sources.metronomeHeader, 'kDefaultNormalSound'),
      accent: parseConstexprInt(sources.metronomeHeader, 'kDefaultAccentSound'),
    },
    minRampBars: parseConstexprInt(sources.tempoRampHeader, 'kMinBars'),
    maxRampBars: parseConstexprInt(sources.tempoRampHeader, 'kMaxBars'),
    minRampStepBpm: parseConstexprDouble(
      sources.tempoRampHeader,
      'kMinStepBpm',
    ),
    muteBars: {
      min: parseConstexprInt(sources.metronomeHeader, 'kMinMuteBars'),
      max: parseConstexprInt(sources.metronomeHeader, 'kMaxMuteBars'),
    },
    subdivision: {
      min: parseConstexprInt(sources.metronomeHeader, 'kMinSubdivision'),
      max: parseConstexprInt(sources.metronomeHeader, 'kMaxSubdivision'),
    },
    bpm: {
      min: parseConstexprDouble(sources.metronomeTypesHeader, 'kMinBpm'),
      max: parseConstexprDouble(sources.metronomeTypesHeader, 'kMaxBpm'),
    },
    volume: {
      min: parseConstexprDouble(sources.metronomeHeader, 'kMinVolume'),
      max: parseConstexprDouble(sources.metronomeHeader, 'kMaxVolume'),
    },
    mixerGain: {
      min: parseConstexprFloat(sources.mixerHeader, 'kMinGain'),
      max: parseConstexprFloat(sources.mixerHeader, 'kMaxGain'),
    },
    rampSeconds: {
      min: parseConstexprDouble(sources.tempoRampHeader, 'kMinSeconds'),
      max: parseConstexprDouble(sources.tempoRampHeader, 'kMaxSeconds'),
    },
    rampUnit: parseEnum(sources.apiHeader, 'kb_ramp_unit'),
    rampState: parseEnum(sources.apiHeader, 'kb_ramp_state'),
    bpmReferenceDenominator: parseConstexprInt(
      sources.metronomeHeader,
      'kBpmReferenceDenominator',
    ),
    denominators: parseConstexprIntArray(
      sources.metronomeHeader,
      'kDenominators',
    ),
    soundNames: parseSoundNames(
      sources.metronomeRender,
      sources.metronomeHeader,
    ),
    result: parseEnum(sources.apiHeader, 'kb_result'),
    accent: parseEnum(sources.apiHeader, 'kb_accent'),
    latencyOffsetMsBounds: parseRangeAfter(
      sources.apiHeader,
      'Output latency offset in ms',
    ),
    barPhaseBounds: parseRangeAfter(
      sources.apiHeader,
      'Position within the bar,',
    ),
    tunerFields: parseTunerFields(sources.apiHeader),
    tunerMaxStrings: parseDefineInt(
      sources.tunerHeader,
      'KB_TUNER_MAX_STRINGS',
    ),
    tunerAutoString: parseDefineNumber(
      sources.tunerHeader,
      'KB_TUNER_AUTO_STRING',
    ),
    tunerNoString: parseDefineNumber(sources.tunerHeader, 'KB_TUNER_NO_STRING'),
    tunerNoNote: parseDefineNumber(sources.tunerHeader, 'KB_TUNER_NO_NOTE'),
    tunerTunedRatio: parseDefineNumber(
      sources.tunerHeader,
      'KB_TUNER_TUNED_RATIO',
    ),
    tunerInstrument: parseEnum(sources.tunerHeader, 'kb_tuner_instrument'),
    tuningStatus: parseEnum(sources.tunerHeader, 'kb_tuning_status'),
    wrongString: parseEnum(sources.tunerHeader, 'kb_wrong_string'),
    tunerA4Hz: {
      min: parseConstexprDouble(sources.tuningModeHeader, 'kMinA4Hz'),
      max: parseConstexprDouble(sources.tuningModeHeader, 'kMaxA4Hz'),
      default: parseConstexprDouble(sources.tuningModeHeader, 'kDefaultA4Hz'),
    },
    tunerIdleSleepMicros: parseConstexprInt(
      sources.tunerImplHeader,
      'kIdleSleepMicros',
    ),
  };
}
