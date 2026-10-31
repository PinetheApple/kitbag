export interface Bounds {
  readonly min: number;
  readonly max: number;
}

export interface EnumMember {
  readonly name: string;
  readonly value: number;
}

export interface RangeBound {
  readonly min: number;
  readonly max: number;
  readonly maxExclusive: boolean;
}

export interface TunerField {
  readonly offset: number;
  readonly width: number;
  readonly signed: boolean;
  readonly scale: number;
}

export interface TunerFields {
  readonly note: TunerField;
  readonly cents: TunerField;
  readonly confidence: TunerField;
}

export interface NativeSources {
  /** native/audio_core/include/kitbag_api.h — the shipped C ABI. */
  readonly apiHeader: string;
  /** native/audio_core/include/kitbag_tuner_api.h — its tuning-mode section. */
  readonly tunerHeader: string;
  /** native/audio_core/include/kitbag_metronome_poly_api.h — KB_POLY_AGAINST_BAR. */
  readonly polyHeader: string;
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
  readonly polyAgainstBar: number;
  readonly polyAgainst: Bounds;
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
