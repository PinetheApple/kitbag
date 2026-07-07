import 'audio_engine.dart';

/// Control surface for the native tuner (mic capture + pitch analysis).
///
/// Setters are fire-and-forget commands to the analysis thread; getters
/// read atomic mirrors and are cheap enough to poll every frame.
class TunerController {
  TunerController(this._engine);

  static const double minA4 = 415;
  static const double maxA4 = 466;
  static const double defaultA4 = 440;

  /// Detection band used in chromatic mode (A1 to above E6); notes below
  /// it are reached through instrument preset bands.
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

  bool get isRunning => _engine.bindings.tunerIsRunning(_engine.handle) != 0;

  void setA4(double a4Hz) =>
      _engine.bindings.tunerSetA4(_engine.handle, a4Hz.clamp(minA4, maxA4));

  /// Constrains detection to `[lowHz, highHz]` — the preset/per-string band
  /// that kills octave errors.
  void setBand(double lowHz, double highHz) =>
      _engine.bindings.tunerSetBand(_engine.handle, lowHz, highHz);

  /// Latest smoothed pitch in Hz, 0 when nothing is sounding.
  double get pitchHz => _engine.bindings.tunerPitchHz(_engine.handle);

  /// Offset from the nearest chromatic note, in cents.
  double get cents => _engine.bindings.tunerCents(_engine.handle);

  /// Detection confidence `[0, 1]`.
  double get confidence => _engine.bindings.tunerConfidence(_engine.handle);

  /// MIDI note number of the nearest note, -1 when no pitch.
  int get noteIndex => _engine.bindings.tunerNoteIndex(_engine.handle);
}
