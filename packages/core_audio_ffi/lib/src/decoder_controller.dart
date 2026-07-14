import 'dart:ffi';
import 'dart:typed_data';

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

  /// Analyzes [path] for beat tracking and waveform peaks.
  ///
  /// Returns `(bpm, beatTimes, waveformPath)` or null on failure.
  /// If [waveformDir] is provided, writes a `.kwav` waveform peaks sidecar.
  /// Standalone — does not use the engine's decoder state.
  (double, Float32List, String?)? analyzeSong(
    String path, {
    String? waveformDir,
  }) {
    const maxBeats = 1024;
    final cPath = path.toNativeUtf8();
    final nativePath = cPath.cast<Int8>();
    final bpmOut = calloc<Float>();
    final beatBuf = calloc<Float>(maxBeats);
    final beatCountOut = calloc<Int32>();
    final cWaveformDir = waveformDir?.toNativeUtf8();
    final nativeWaveformDir = cWaveformDir?.cast<Int8>();

    try {
      final result = _engine.bindings.analyzeSong(
        nativePath,
        bpmOut,
        beatBuf,
        maxBeats,
        beatCountOut,
        nativeWaveformDir ?? nullptr,
      );

      if (result != 0) return null;

      final bpm = bpmOut.value;
      final count = beatCountOut.value;
      if (count <= 0) return null;

      final beats = Float32List(count);
      for (int i = 0; i < count; i++) {
        beats[i] = beatBuf[i];
      }

      // Derive the waveform path that the C layer wrote
      String? kwavPath;
      if (waveformDir != null) {
        final basename = path.split('/').last;
        final dot = basename.lastIndexOf('.');
        final name = dot >= 0 ? basename.substring(0, dot) : basename;
        kwavPath = '${waveformDir.endsWith('/') ? waveformDir : '$waveformDir/'}$name.kwav';
      }

      return (bpm, beats, kwavPath);
    } finally {
      calloc.free(cPath);
      calloc.free(bpmOut);
      calloc.free(beatBuf);
      calloc.free(beatCountOut);
      if (cWaveformDir != null) calloc.free(cWaveformDir);
    }
  }
}
