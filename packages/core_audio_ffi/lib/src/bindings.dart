// Hand-written bindings for native/audio_core/include/kitbag_api.h.
// TODO(kitbag): replace with ffigen output once the API grows past a handful
// of functions.
import 'dart:ffi';
import 'dart:io';

typedef _CreateNative = Int32 Function(Pointer<Pointer<Void>>);
typedef _CreateDart = int Function(Pointer<Pointer<Void>>);
typedef _EngineOpNative = Int32 Function(Pointer<Void>);
typedef _EngineOpDart = int Function(Pointer<Void>);
typedef _EngineVoidOpNative = Void Function(Pointer<Void>);
typedef _EngineVoidOpDart = void Function(Pointer<Void>);
typedef _SampleRateNative = Uint32 Function(Pointer<Void>);
typedef _SampleRateDart = int Function(Pointer<Void>);
typedef _FramesNative = Uint64 Function(Pointer<Void>);
typedef _FramesDart = int Function(Pointer<Void>);
typedef _SetToneNative = Void Function(Pointer<Void>, Int32, Float);
typedef _SetToneDart = void Function(Pointer<Void>, int, double);

class KitbagBindings {
  KitbagBindings(DynamicLibrary library)
      : engineCreate = library
            .lookupFunction<_CreateNative, _CreateDart>('kb_engine_create'),
        engineDestroy = library.lookupFunction<_EngineVoidOpNative,
            _EngineVoidOpDart>('kb_engine_destroy'),
        engineStart = library
            .lookupFunction<_EngineOpNative, _EngineOpDart>('kb_engine_start'),
        engineStop = library.lookupFunction<_EngineVoidOpNative,
            _EngineVoidOpDart>('kb_engine_stop'),
        engineSampleRate =
            library.lookupFunction<_SampleRateNative, _SampleRateDart>(
                'kb_engine_sample_rate'),
        engineFramesRendered = library
            .lookupFunction<_FramesNative, _FramesDart>(
                'kb_engine_frames_rendered'),
        engineSetTestTone = library.lookupFunction<_SetToneNative,
            _SetToneDart>('kb_engine_set_test_tone');

  static const String _libraryName = 'kitbag_core';

  final _CreateDart engineCreate;
  final _EngineVoidOpDart engineDestroy;
  final _EngineOpDart engineStart;
  final _EngineVoidOpDart engineStop;
  final _SampleRateDart engineSampleRate;
  final _FramesDart engineFramesRendered;
  final _SetToneDart engineSetTestTone;

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
        'kitbag_core has no build for ${Platform.operatingSystem} yet');
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
