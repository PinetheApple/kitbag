import 'audio_engine.dart';

/// One tear-free tuner reading, decoded from the packed native snapshot.
class TunerReading {
  const TunerReading({
    required this.noteIndex,
    required this.cents,
    required this.confidence,
  });

  /// The stopped/silent reading.
  const TunerReading.none() : noteIndex = -1, cents = 0, confidence = 0;

  /// MIDI note number of the nearest chromatic note, -1 when no pitch.
  final int noteIndex;

  /// Offset from that note in cents (0.01 cent resolution).
  final double cents;

  /// Detection confidence `[0, 1]`.
  final double confidence;

  bool get hasPitch => noteIndex >= 0;
}

/// Control surface for the native tuner (mic capture + pitch analysis).
///
/// Setters are fire-and-forget commands to the analysis thread; [read] is a
/// single atomic poll, cheap enough for every frame.
class TunerController {
  TunerController(this._engine);

  // The single clamp point for A4; the range mirrors kMinA4Hz/kMaxA4Hz in
  // native/audio_core/src/pitch_analyzer.h.
  static const double minA4 = 415;
  static const double maxA4 = 466;
  static const double defaultA4 = 440;

  /// Detection band used in chromatic mode (A1 to above E6); notes below
  /// it are reached through instrument preset bands. Mirrors
  /// kChromaticLowHz/kChromaticHighHz in native/audio_core/src/pitch_analyzer.h.
  static const double chromaticLowHz = 55;
  static const double chromaticHighHz = 1400;

  final AudioEngine _engine;

  /// Opens the mic and starts pitch analysis.
  void start() {
    final result = _engine.bindings.tunerStart(_engine.handle);
    if (result != 0) {
      throw AudioEngineException(AudioEngineError.fromCode(result));
    }
  }

  void stop() => _engine.bindings.tunerStop(_engine.handle);

  void setA4(double a4Hz) =>
      _engine.bindings.tunerSetA4(_engine.handle, a4Hz.clamp(minA4, maxA4));

  /// Constrains detection to `[lowHz, highHz]` — the preset/per-string band
  /// that kills octave errors.
  void setBand(double lowHz, double highHz) =>
      _engine.bindings.tunerSetBand(_engine.handle, lowHz, highHz);

  /// Latest smoothed reading. Field packing mirrors kb_tuner_snapshot in
  /// native/audio_core/include/kitbag_api.h.
  TunerReading read() {
    final packed = _engine.bindings.tunerSnapshot(_engine.handle);
    return TunerReading(
      noteIndex: (packed & 0xFFFF).toSigned(16),
      cents: ((packed >> 16) & 0xFFFF).toSigned(16) / 100,
      confidence: ((packed >> 32) & 0xFFFF) / 10000,
    );
  }
}
