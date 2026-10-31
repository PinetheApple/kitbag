import {
  parseConstexprDouble,
  parseConstexprFloat,
  parseConstexprInt,
  parseConstexprIntArray,
  parseDefineInt,
  parseDefineNumber,
  parseDocumentedSymmetricBound,
  parseEnum,
  parseRangeAfter,
  parseSoundNames,
  parseTunerFields,
} from './native-parsers.ts';
import type { NativeConstants, NativeSources } from './native-types.ts';

export * from './native-parsers.ts';
export type * from './native-types.ts';
export { renderConstants } from './native-render.ts';

export function collectConstants(sources: NativeSources): NativeConstants {
  return {
    maxGridBeats: parseDefineInt(sources.apiHeader, 'KB_MAX_GRID_BEATS'),
    maxTracks: parseConstexprInt(sources.mixerHeader, 'kMaxTracks'),
    maxBeats: parseConstexprInt(sources.metronomeHeader, 'kMaxBeats'),
    minPolyBeats: parseConstexprInt(sources.metronomeHeader, 'kMinPolyBeats'),
    maxPolyBeats: parseConstexprInt(sources.metronomeHeader, 'kMaxPolyBeats'),
    polyAgainstBar: parseDefineInt(sources.polyHeader, 'KB_POLY_AGAINST_BAR'),
    polyPhaseNone: parseDefineNumber(sources.polyHeader, 'KB_POLY_PHASE_NONE'),
    polyAgainst: {
      min: parseConstexprInt(sources.metronomeHeader, 'kMinPolyAgainst'),
      max: parseConstexprInt(sources.metronomeHeader, 'kMaxPolyAgainst'),
    },
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
    latencyOffsetMsBounds: parseDocumentedSymmetricBound(
      sources.metronomeHeader,
      'kMaxLatencyOffsetMs',
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
