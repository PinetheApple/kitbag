import 'dart:ffi';

import 'package:ffi/ffi.dart';

import 'bindings.dart';
import 'metronome_controller.dart';
import 'tuner_controller.dart';

/// Result codes mirrored from `kb_result` in kitbag_api.h.
enum AudioEngineError {
  invalidArgument(1),
  deviceInitFailed(2),
  deviceStartFailed(3);

  const AudioEngineError(this.code);
  final int code;

  static AudioEngineError fromCode(int code) =>
      values.firstWhere((value) => value.code == code);
}

class AudioEngineException implements Exception {
  AudioEngineException(this.error);
  final AudioEngineError error;

  @override
  String toString() => 'AudioEngineException(${error.name})';
}

/// Facade over the native realtime engine. One instance per app.
class AudioEngine {
  AudioEngine._(this._bindings, this._handle);

  static const int _resultOk = 0;

  final KitbagBindings _bindings;
  Pointer<Void> _handle;
  late final MetronomeController metronome = MetronomeController(this);
  late final TunerController tuner = TunerController(this);

  /// Internal — used by tool controllers within this package.
  KitbagBindings get bindings => _bindings;
  Pointer<Void> get handle => _handle;

  static AudioEngine create() {
    final bindings = KitbagBindings(KitbagBindings.openLibrary());
    final out = calloc<Pointer<Void>>();
    try {
      final result = bindings.engineCreate(out);
      if (result != _resultOk) {
        throw AudioEngineException(AudioEngineError.fromCode(result));
      }
      return AudioEngine._(bindings, out.value);
    } finally {
      calloc.free(out);
    }
  }

  bool get isDisposed => _handle == nullptr;

  int get sampleRate => _bindings.engineSampleRate(_handle);

  /// Frames rendered since start — the master clock, in samples.
  int get framesRendered => _bindings.engineFramesRendered(_handle);

  void start() {
    final result = _bindings.engineStart(_handle);
    if (result != _resultOk) {
      throw AudioEngineException(AudioEngineError.fromCode(result));
    }
  }

  void stop() => _bindings.engineStop(_handle);

  void setTestTone({required bool enabled, double frequencyHz = 440.0}) {
    _bindings.engineSetTestTone(_handle, enabled ? 1 : 0, frequencyHz);
  }

  void dispose() {
    if (!isDisposed) {
      _bindings.engineDestroy(_handle);
      _handle = nullptr;
    }
  }
}
