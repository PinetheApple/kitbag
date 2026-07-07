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
typedef GetIntNative = Int32 Function(Pointer<Void>);
typedef GetIntDart = int Function(Pointer<Void>);
typedef GetDoubleNative = Double Function(Pointer<Void>);
typedef GetDoubleDart = double Function(Pointer<Void>);
typedef SetTwoDoublesNative = Void Function(Pointer<Void>, Double, Double);
typedef SetTwoDoublesDart = void Function(Pointer<Void>, double, double);

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
      tunerStart = library.lookupFunction<EngineOpNative, EngineOpDart>(
        'kb_tuner_start',
      ),
      tunerStop = library.lookupFunction<EngineVoidOpNative, EngineVoidOpDart>(
        'kb_tuner_stop',
      ),
      tunerIsRunning = library.lookupFunction<GetIntNative, GetIntDart>(
        'kb_tuner_is_running',
      ),
      tunerSetA4 = library.lookupFunction<SetDoubleNative, SetDoubleDart>(
        'kb_tuner_set_a4',
      ),
      tunerSetBand = library
          .lookupFunction<SetTwoDoublesNative, SetTwoDoublesDart>(
            'kb_tuner_set_band',
          ),
      tunerPitchHz = library.lookupFunction<GetDoubleNative, GetDoubleDart>(
        'kb_tuner_pitch_hz',
      ),
      tunerCents = library.lookupFunction<GetDoubleNative, GetDoubleDart>(
        'kb_tuner_cents',
      ),
      tunerConfidence = library.lookupFunction<GetDoubleNative, GetDoubleDart>(
        'kb_tuner_confidence',
      ),
      tunerNoteIndex = library.lookupFunction<GetIntNative, GetIntDart>(
        'kb_tuner_note_index',
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
  final GetIntDart metronomeIsRunning;
  final GetIntDart metronomeCurrentBeat;
  final GetIntDart metronomeCurrentPolyBeat;
  final GetDoubleDart metronomeBarPhase;
  final EngineOpDart tunerStart;
  final EngineVoidOpDart tunerStop;
  final GetIntDart tunerIsRunning;
  final SetDoubleDart tunerSetA4;
  final SetTwoDoublesDart tunerSetBand;
  final GetDoubleDart tunerPitchHz;
  final GetDoubleDart tunerCents;
  final GetDoubleDart tunerConfidence;
  final GetIntDart tunerNoteIndex;

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
