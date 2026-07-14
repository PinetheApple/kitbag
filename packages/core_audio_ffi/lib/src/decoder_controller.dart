import 'dart:ffi';

import 'package:ffi/ffi.dart';

import 'audio_engine.dart';

/// Provides metadata from audio files via the native decoder.
///
/// All methods are blocking (disk I/O + decode happens synchronously in the
/// C layer). Call from an isolate if the file is large.
class DecoderController {
  DecoderController(this._engine);

  final AudioEngine _engine;

  /// Opens [path] and returns `(durationSeconds, sampleRate, channels)`.
  /// Returns null on failure (unsupported format, missing file, etc).
  (double, int, int)? open(String path) {
    final cPath = path.toNativeUtf8();
    final nativePath = cPath.cast<Int8>();
    try {
      final result = _engine.bindings.decoderOpen(_engine.handle, nativePath);
      if (result != 0) {
        close();
        return null;
      }
      final duration = _engine.bindings.decoderDuration(_engine.handle);
      final sampleRate = _engine.bindings.decoderSampleRate(_engine.handle);
      final channels = _engine.bindings.decoderChannels(_engine.handle);
      close();
      return (duration, sampleRate, channels);
    } finally {
      calloc.free(cPath);
    }
  }

  void close() {
    _engine.bindings.decoderClose(_engine.handle);
  }
}
