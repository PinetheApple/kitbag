// Hand-written bindings for native/audio_core/include/kitbag_api.h.
// TODO(kitbag): replace with ffigen output once the API grows past a handful
// of functions.
import 'dart:ffi';
import 'dart:io';

typedef CreateNative = Int32 Function(Pointer<Pointer<Void>>);
typedef CreateDart = int Function(Pointer<Pointer<Void>>);
typedef EngineOpNative = Int32 Function(Pointer<Void>);
typedef EngineOpDart = int Function(Pointer<Void>);
typedef EngineVoidOpNative = Void Function(Pointer<Void>);
typedef EngineVoidOpDart = void Function(Pointer<Void>);
typedef SampleRateNative = Uint32 Function(Pointer<Void>);
typedef SampleRateDart = int Function(Pointer<Void>);
typedef FramesNative = Uint64 Function(Pointer<Void>);
typedef FramesDart = int Function(Pointer<Void>);
typedef SetToneNative = Void Function(Pointer<Void>, Int32, Float);
typedef SetToneDart = void Function(Pointer<Void>, int, double);
typedef SetDoubleNative = Void Function(Pointer<Void>, Double);
typedef SetDoubleDart = void Function(Pointer<Void>, double);
typedef SetIntNative = Void Function(Pointer<Void>, Int32);
typedef SetIntDart = void Function(Pointer<Void>, int);
typedef SetTwoIntsNative = Void Function(Pointer<Void>, Int32, Int32);
typedef SetTwoIntsDart = void Function(Pointer<Void>, int, int);
typedef SetRampNative =
    Void Function(Pointer<Void>, Int32, Double, Double, Int32);
typedef SetRampDart = void Function(Pointer<Void>, int, double, double, int);
typedef SetThreeIntsNative = Void Function(Pointer<Void>, Int32, Int32, Int32);
typedef SetThreeIntsDart = void Function(Pointer<Void>, int, int, int);
typedef GetIntNative = Int32 Function(Pointer<Void>);
typedef GetIntDart = int Function(Pointer<Void>);
typedef GetDoubleNative = Double Function(Pointer<Void>);
typedef GetDoubleDart = double Function(Pointer<Void>);
typedef SetTwoDoublesNative = Void Function(Pointer<Void>, Double, Double);
typedef SetTwoDoublesDart = void Function(Pointer<Void>, double, double);
typedef DecoderOpenNative = Int32 Function(Pointer<Void>, Pointer<Int8>);
typedef DecoderOpenDart = int Function(Pointer<Void>, Pointer<Int8>);
typedef DecoderCloseNative = Void Function(Pointer<Void>);
typedef DecoderCloseDart = void Function(Pointer<Void>);
typedef DecoderGetDoubleNative = Double Function(Pointer<Void>);
typedef DecoderGetDoubleDart = double Function(Pointer<Void>);
typedef DecoderGetUint32Native = Uint32 Function(Pointer<Void>);
typedef DecoderGetUint32Dart = int Function(Pointer<Void>);

class KitbagBindings {
  KitbagBindings(DynamicLibrary library)
    : engineCreate = library.lookupFunction<CreateNative, CreateDart>(
        'kb_engine_create',
      ),
      engineDestroy = library
          .lookupFunction<EngineVoidOpNative, EngineVoidOpDart>(
            'kb_engine_destroy',
          ),
      engineStart = library.lookupFunction<EngineOpNative, EngineOpDart>(
        'kb_engine_start',
      ),
      engineStop = library.lookupFunction<EngineVoidOpNative, EngineVoidOpDart>(
        'kb_engine_stop',
      ),
      engineSampleRate = library
          .lookupFunction<SampleRateNative, SampleRateDart>(
            'kb_engine_sample_rate',
          ),
      engineFramesRendered = library.lookupFunction<FramesNative, FramesDart>(
        'kb_engine_frames_rendered',
      ),
      engineSetTestTone = library.lookupFunction<SetToneNative, SetToneDart>(
        'kb_engine_set_test_tone',
      ),
      metronomeStart = library
          .lookupFunction<EngineVoidOpNative, EngineVoidOpDart>(
            'kb_metronome_start',
          ),
      metronomeStop = library
          .lookupFunction<EngineVoidOpNative, EngineVoidOpDart>(
            'kb_metronome_stop',
          ),
      metronomeSetTempo = library
          .lookupFunction<SetDoubleNative, SetDoubleDart>(
            'kb_metronome_set_tempo',
          ),
      metronomeSetBeats = library.lookupFunction<SetIntNative, SetIntDart>(
        'kb_metronome_set_beats',
      ),
      metronomeSetSubdivision = library
          .lookupFunction<SetIntNative, SetIntDart>(
            'kb_metronome_set_subdivision',
          ),
      metronomeSetAccent = library
          .lookupFunction<SetTwoIntsNative, SetTwoIntsDart>(
            'kb_metronome_set_accent',
          ),
      metronomeSetPoly = library
          .lookupFunction<SetTwoIntsNative, SetTwoIntsDart>(
            'kb_metronome_set_poly',
          ),
      metronomeSetSound = library.lookupFunction<SetIntNative, SetIntDart>(
        'kb_metronome_set_sound',
      ),
      metronomeSetVolume = library.lookupFunction<SetDoubleNative, SetDoubleDart>(
        'kb_metronome_set_volume',
      ),
      metronomeSetLatencyOffset = library
          .lookupFunction<SetDoubleNative, SetDoubleDart>(
            'kb_metronome_set_latency_offset',
          ),
      metronomeSetRamp = library.lookupFunction<SetRampNative, SetRampDart>(
        'kb_metronome_set_ramp',
      ),
      metronomeSetBarMute = library
          .lookupFunction<SetThreeIntsNative, SetThreeIntsDart>(
            'kb_metronome_set_bar_mute',
          ),
      metronomeIsRunning = library.lookupFunction<GetIntNative, GetIntDart>(
        'kb_metronome_is_running',
      ),
      metronomeCurrentBeat = library.lookupFunction<GetIntNative, GetIntDart>(
        'kb_metronome_current_beat',
      ),
      metronomeCurrentPolyBeat = library
          .lookupFunction<GetIntNative, GetIntDart>(
            'kb_metronome_current_poly_beat',
          ),
      metronomeBarPhase = library
          .lookupFunction<GetDoubleNative, GetDoubleDart>(
            'kb_metronome_bar_phase',
          ),
      metronomeCurrentBpm = library
          .lookupFunction<GetDoubleNative, GetDoubleDart>(
            'kb_metronome_current_bpm',
          ),
      metronomeBarMuted = library.lookupFunction<GetIntNative, GetIntDart>(
        'kb_metronome_bar_muted',
      ),
      tunerStart = library.lookupFunction<EngineOpNative, EngineOpDart>(
        'kb_tuner_start',
      ),
      tunerStop = library.lookupFunction<EngineVoidOpNative, EngineVoidOpDart>(
        'kb_tuner_stop',
      ),
      tunerSetA4 = library.lookupFunction<SetDoubleNative, SetDoubleDart>(
        'kb_tuner_set_a4',
      ),
      tunerSetBand = library
          .lookupFunction<SetTwoDoublesNative, SetTwoDoublesDart>(
            'kb_tuner_set_band',
          ),
      tunerSnapshot = library.lookupFunction<FramesNative, FramesDart>(
        'kb_tuner_snapshot',
      ),
      decoderOpen = library.lookupFunction<DecoderOpenNative, DecoderOpenDart>(
        'kb_decoder_open',
      ),
      decoderClose = library
          .lookupFunction<DecoderCloseNative, DecoderCloseDart>(
            'kb_decoder_close',
          ),
      decoderDuration = library
          .lookupFunction<DecoderGetDoubleNative, DecoderGetDoubleDart>(
            'kb_decoder_duration',
          ),
      decoderSampleRate = library
          .lookupFunction<DecoderGetUint32Native, DecoderGetUint32Dart>(
            'kb_decoder_sample_rate',
          ),
      decoderChannels = library
          .lookupFunction<DecoderGetUint32Native, DecoderGetUint32Dart>(
            'kb_decoder_channels',
          );

  static const String _libraryName = 'kitbag_core';

  final CreateDart engineCreate;
  final EngineVoidOpDart engineDestroy;
  final EngineOpDart engineStart;
  final EngineVoidOpDart engineStop;
  final SampleRateDart engineSampleRate;
  final FramesDart engineFramesRendered;
  final SetToneDart engineSetTestTone;
  final EngineVoidOpDart metronomeStart;
  final EngineVoidOpDart metronomeStop;
  final SetDoubleDart metronomeSetTempo;
  final SetIntDart metronomeSetBeats;
  final SetIntDart metronomeSetSubdivision;
  final SetTwoIntsDart metronomeSetAccent;
  final SetTwoIntsDart metronomeSetPoly;
  final SetIntDart metronomeSetSound;
  final SetDoubleDart metronomeSetVolume;
  final SetDoubleDart metronomeSetLatencyOffset;
  final SetRampDart metronomeSetRamp;
  final SetThreeIntsDart metronomeSetBarMute;
  final GetIntDart metronomeIsRunning;
  final GetIntDart metronomeCurrentBeat;
  final GetIntDart metronomeCurrentPolyBeat;
  final GetDoubleDart metronomeBarPhase;
  final GetDoubleDart metronomeCurrentBpm;
  final GetIntDart metronomeBarMuted;
  final EngineOpDart tunerStart;
  final EngineVoidOpDart tunerStop;
  final SetDoubleDart tunerSetA4;
  final SetTwoDoublesDart tunerSetBand;
  final FramesDart tunerSnapshot;
  final DecoderOpenDart decoderOpen;
  final DecoderCloseDart decoderClose;
  final DecoderGetDoubleDart decoderDuration;
  final DecoderGetUint32Dart decoderSampleRate;
  final DecoderGetUint32Dart decoderChannels;

  static DynamicLibrary openLibrary() {
    if (Platform.isAndroid) {
      return DynamicLibrary.open('lib$_libraryName.so');
    }
    if (Platform.isLinux) {
      return _openLinux();
    }
    if (Platform.isMacOS || Platform.isIOS) {
      return DynamicLibrary.open('lib$_libraryName.dylib');
    }
    throw UnsupportedError(
      'kitbag_core has no build for ${Platform.operatingSystem} yet',
    );
  }

  static DynamicLibrary _openLinux() {
    final executableDir = File(Platform.resolvedExecutable).parent.path;
    final candidates = [
      '$executableDir/lib/lib$_libraryName.so',
      'lib$_libraryName.so',
    ];
    final override = Platform.environment['KITBAG_CORE_PATH'];
    if (override != null) {
      candidates.insert(0, override);
    }
    Object? lastError;
    for (final path in candidates) {
      try {
        return DynamicLibrary.open(path);
      } on ArgumentError catch (error) {
        lastError = error;
      }
    }
    throw StateError('could not load lib$_libraryName.so: $lastError');
  }
}
